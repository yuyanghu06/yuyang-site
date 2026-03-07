#!/usr/bin/env python3
"""
Apple iMessage Scraper
Reads the macOS Messages SQLite database (or an iPhone backup) and exports all
conversations as a JSONL file formatted for pretraining ({"text": "..."} per line).

Supports two sources:
  1. Live chat.db  (default, macOS Messages app):
       python scripts/scrape_imessages.py --output data/imessages.jsonl

  2. iPhone backup (unencrypted or encrypted):
       python scripts/scrape_imessages.py --backup-path ~/path/to/backup/ --output data/imessages.jsonl
       python scripts/scrape_imessages.py --backup-path ~/path/to/backup/ --backup-password "mypassword" --output data/imessages.jsonl

Backups are typically found at:
  ~/Library/Application Support/MobileSync/Backup/<device-uuid>/
"""

import getpass
import json
import plistlib
import sqlite3
import struct
import tempfile
import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# iPhone backup decryption
# ---------------------------------------------------------------------------

def _parse_keybag(data: bytes) -> dict:
    """
    Parse an iOS backup keybag binary blob into a dict with:
      salt, iter, dpsl, dpic  -- for key derivation
      classes: {class_id: {'wpky': bytes}}  -- wrapped class keys
    """
    keybag = {"salt": None, "iter": None, "dpic": None, "dpsl": None, "classes": {}}
    current_class = None
    i = 0
    while i + 8 <= len(data):
        tag = data[i:i + 4].decode("ascii", errors="replace")
        length = struct.unpack(">I", data[i + 4:i + 8])[0]
        value = data[i + 8:i + 8 + length]
        i += 8 + length
        if tag == "SALT":
            keybag["salt"] = value
        elif tag == "ITER":
            keybag["iter"] = struct.unpack(">I", value)[0]
        elif tag == "DPIC":
            keybag["dpic"] = struct.unpack(">I", value)[0]
        elif tag == "DPSL":
            keybag["dpsl"] = value
        elif tag == "CLAS":
            current_class = struct.unpack(">I", value)[0]
            keybag["classes"].setdefault(current_class, {})
        elif tag == "WPKY" and current_class is not None:
            keybag["classes"][current_class]["wpky"] = value
    return keybag


def _unlock_keybag(keybag: dict, password: str) -> dict:
    """
    Derive the password key via PBKDF2 and AES-unwrap each class key.
    Returns {class_id: unwrapped_key_bytes}.

    Modern iOS uses a double-PBKDF2 scheme (dpsl/dpic fields present);
    older iOS uses a single PBKDF2-HMAC-SHA1 round.
    """
    try:
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.keywrap import aes_key_unwrap
        from cryptography.hazmat.backends import default_backend
    except ImportError:
        raise ImportError("Install the 'cryptography' package: pip install cryptography>=41.0.0")

    backend = default_backend()
    pw = password.encode("utf-8")

    if keybag.get("dpsl"):
        # Modern iOS: round 1 = PBKDF2-HMAC-SHA256 with dpsl/dpic
        kdf1 = PBKDF2HMAC(
            algorithm=hashes.SHA256(), length=32,
            salt=keybag["dpsl"], iterations=keybag.get("dpic", 10_000_000),
            backend=backend,
        )
        tmp = kdf1.derive(pw)
        # Round 2 = PBKDF2-HMAC-SHA1 with salt/iter (using round-1 output as password)
        kdf2 = PBKDF2HMAC(
            algorithm=hashes.SHA1(), length=32,
            salt=keybag["salt"], iterations=keybag.get("iter", 1),
            backend=backend,
        )
        password_key = kdf2.derive(tmp)
    else:
        # Legacy iOS: single PBKDF2-HMAC-SHA1
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA1(), length=32,
            salt=keybag["salt"], iterations=keybag.get("iter", 10_000),
            backend=backend,
        )
        password_key = kdf.derive(pw)

    unlocked = {}
    for class_id, info in keybag["classes"].items():
        if "wpky" in info:
            try:
                unlocked[class_id] = aes_key_unwrap(password_key, info["wpky"], backend)
            except Exception:
                pass  # wrong password or unsupported class
    return unlocked


def _aes_cbc_decrypt(key: bytes, data: bytes) -> bytes:
    """AES-256-CBC decrypt with a null IV (used for all backup file content)."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    cipher = Cipher(algorithms.AES(key), modes.CBC(b"\x00" * 16), backend=default_backend())
    d = cipher.decryptor()
    return d.update(data) + d.finalize()


def _unwrap_file_key(enc_key_blob: bytes, class_keys: dict) -> bytes:
    """
    Unwrap a per-file encryption key.
    enc_key_blob = 4-byte little-endian protection class + 40-byte AES-wrapped key.
    """
    from cryptography.hazmat.primitives.keywrap import aes_key_unwrap
    from cryptography.hazmat.backends import default_backend
    protection_class = struct.unpack("<I", enc_key_blob[:4])[0]
    wrapped = enc_key_blob[4:]
    if protection_class not in class_keys:
        raise ValueError(f"Class key {protection_class} not available (wrong password?)")
    return aes_key_unwrap(class_keys[protection_class], wrapped, default_backend())


def _decrypt_manifest_db(backup_path: Path, class_keys: dict, manifest_plist: dict) -> str:
    """Decrypt Manifest.db, write to a temp file, and return its path."""
    from cryptography.hazmat.primitives.keywrap import aes_key_unwrap
    from cryptography.hazmat.backends import default_backend

    manifest_key_blob = bytes(manifest_plist["ManifestKey"])
    protection_class = struct.unpack("<I", manifest_key_blob[:4])[0]
    wrapped = manifest_key_blob[4:]

    if protection_class not in class_keys:
        raise ValueError(f"Class key {protection_class} unavailable for ManifestKey")

    manifest_key = aes_key_unwrap(class_keys[protection_class], wrapped, default_backend())

    with open(backup_path / "Manifest.db", "rb") as f:
        encrypted = f.read()

    decrypted = _aes_cbc_decrypt(manifest_key, encrypted)

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.write(decrypted)
    tmp.close()
    return tmp.name


def extract_chat_db_from_backup(backup_path: str, password: str = None) -> tuple[str, bool]:
    """
    Locate and (if encrypted) decrypt sms.db from an iPhone backup.

    Returns (path_to_chat_db, is_temp_file).
    Caller is responsible for deleting the file if is_temp_file is True.
    """
    backup = Path(backup_path).expanduser().resolve()

    # Walk up from wherever the user pointed until we find the backup root
    # (handles passing the hash file path or a subdirectory like 3d/)
    search = backup if backup.is_dir() else backup.parent
    while True:
        if (search / "Manifest.plist").exists():
            backup = search
            break
        parent = search.parent
        if parent == search:
            # Reached filesystem root without finding Manifest.plist
            raise FileNotFoundError(
                f"Could not find Manifest.plist starting from: {Path(backup_path).expanduser().resolve()}\n\n"
                "This script requires the full iPhone backup directory.\n"
                "Pass the backup root directly, e.g.:\n"
                "  --backup-path '~/Library/Application Support/MobileSync/Backup/<device-uuid>/'\n\n"
                "The backup directory must contain: Manifest.plist, Manifest.db, and the hashed file tree."
            )
        search = parent

    logger.info(f"Using backup root: {backup}")

    with open(backup / "Manifest.plist", "rb") as f:
        manifest_plist = plistlib.load(f)

    is_encrypted = manifest_plist.get("IsEncrypted", False)

    if is_encrypted:
        if not password:
            password = getpass.getpass("Backup password: ")

        logger.info("Parsing keybag and deriving class keys (this may take a moment)...")
        keybag = _parse_keybag(bytes(manifest_plist["BackupKeyBag"]))
        class_keys = _unlock_keybag(keybag, password)
        if not class_keys:
            raise ValueError("Failed to unlock any class keys — password is likely incorrect")
        logger.info(f"Unlocked {len(class_keys)} class key(s)")

        tmp_manifest_path = _decrypt_manifest_db(backup, class_keys, manifest_plist)
        try:
            mconn = sqlite3.connect(tmp_manifest_path)
            mcur = mconn.cursor()
            mcur.execute(
                "SELECT fileID, file FROM Files "
                "WHERE domain='HomeDomain' AND relativePath='Library/SMS/sms.db'"
            )
            row = mcur.fetchone()
            mconn.close()
        finally:
            Path(tmp_manifest_path).unlink(missing_ok=True)

        if not row:
            raise FileNotFoundError("sms.db not found in decrypted Manifest.db")

        file_id, file_blob = row
        encrypted_file_path = backup / file_id[:2] / file_id

        # Decode the NSKeyedArchiver plist to get the per-file encryption key
        file_plist = plistlib.loads(bytes(file_blob))
        objects = file_plist["$objects"]
        root = objects[file_plist["$top"]["root"].data]

        enc_key_uid = root.get("EncryptionKey")
        if enc_key_uid is None:
            raise ValueError("sms.db has no EncryptionKey in manifest — unexpected backup format")

        enc_key_data = objects[enc_key_uid.data]
        # The raw key bytes are stored under 'NS.data' (NSData wrapper)
        enc_key_blob = bytes(enc_key_data.get("NS.data", enc_key_data.get("$data", b"")))
        file_key = _unwrap_file_key(enc_key_blob, class_keys)

        # File size for trimming AES padding
        file_size = root.get("Size", None)

        with open(encrypted_file_path, "rb") as f:
            encrypted_data = f.read()

        decrypted_data = _aes_cbc_decrypt(file_key, encrypted_data)
        if file_size:
            decrypted_data = decrypted_data[:file_size]

        tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp_db.write(decrypted_data)
        tmp_db.close()
        logger.info("Successfully decrypted sms.db from encrypted backup")
        return tmp_db.name, True

    else:
        # Unencrypted backup: Manifest.db is a plain SQLite file
        mconn = sqlite3.connect(str(backup / "Manifest.db"))
        mcur = mconn.cursor()
        mcur.execute(
            "SELECT fileID FROM Files "
            "WHERE domain='HomeDomain' AND relativePath='Library/SMS/sms.db'"
        )
        row = mcur.fetchone()
        mconn.close()
        if not row:
            raise FileNotFoundError("sms.db not found in backup Manifest.db")
        file_id = row[0]
        return str(backup / file_id[:2] / file_id), False


def decode_attributed_body(blob: bytes) -> str:
    """
    Extract plain text from an NSAttributedString stored as a binary plist.
    Modern iMessages store message text here instead of the plain `text` column.
    """
    try:
        plist = plistlib.loads(blob)
        objects = plist["$objects"]
        root_idx = plist["$top"]["root"].data
        root_obj = objects[root_idx]
        string_idx = root_obj["NSString"].data
        text = objects[string_idx]
        return text if isinstance(text, str) else ""
    except Exception:
        return ""


def _date_to_apple_timestamp(date_str: str) -> int:
    """
    Convert a YYYY-MM-DD date string to an Apple Core Data timestamp.
    Returns the threshold in nanoseconds (matching modern iOS storage).
    """
    from datetime import datetime, timezone
    APPLE_EPOCH_OFFSET = 978307200
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    unix_ts = dt.timestamp()
    return int((unix_ts - APPLE_EPOCH_OFFSET) * 1e9)


def _get_columns(cur: sqlite3.Cursor, table: str) -> set:
    """Return the set of column names for a table."""
    cur.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


def scrape_messages(db_path: str, output_path: str, min_messages: int = 2, since: str = None):
    """
    Read the Messages database and write conversations to a JSONL file.

    Args:
        db_path:      Path to chat.db / sms.db
        output_path:  Path to write the output .jsonl file
        min_messages: Skip conversations with fewer messages than this threshold
        since:        If set (YYYY-MM-DD), skip messages sent before this date
    """
    db_path = Path(db_path).expanduser().resolve()
    if not db_path.exists():
        raise FileNotFoundError(
            f"Database not found at: {db_path}\n"
            "Make sure Full Disk Access is granted to your terminal in "
            "System Settings > Privacy & Security > Full Disk Access."
        )

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Connecting to: {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Detect available columns so we work with both macOS chat.db and iPhone sms.db
    msg_cols = _get_columns(cur, "message")
    has_attributed_body = "attributedBody" in msg_cols
    has_reaction_type = "associated_message_type" in msg_cols
    logger.info(
        f"Schema: attributedBody={'yes' if has_attributed_body else 'no'}, "
        f"associated_message_type={'yes' if has_reaction_type else 'no'}"
    )

    select_cols = ["m.text"]
    if has_attributed_body:
        select_cols.append("m.attributedBody")
    if has_reaction_type:
        select_cols.append("m.associated_message_type")

    date_filter = ""
    date_params: tuple = ()
    if since:
        since_ts = _date_to_apple_timestamp(since)
        date_filter = "AND m.date >= ?"
        date_params = (since_ts,)
        logger.info(f"Filtering messages on or after {since}")

    query = f"""
        SELECT {', '.join(select_cols)}
        FROM message m
        JOIN chat_message_join cmj ON cmj.message_id = m.rowid
        WHERE cmj.chat_id = ? AND m.is_from_me = 1 {date_filter}
        ORDER BY m.date ASC
    """

    # Fetch all chats
    cur.execute("SELECT rowid AS chat_id FROM chat ORDER BY rowid")
    chats = cur.fetchall()
    logger.info(f"Found {len(chats)} conversations")

    written = 0
    skipped = 0

    with open(output_path, "w", encoding="utf-8") as out_f:
        for chat in chats:
            chat_id = chat["chat_id"]

            cur.execute(query, (chat_id, *date_params))
            rows = cur.fetchall()

            if len(rows) < min_messages:
                skipped += 1
                continue

            lines = []
            for row in rows:
                # Skip tapback reactions (associated_message_type 2000–2006 are reactions)
                if has_reaction_type and row["associated_message_type"] and row["associated_message_type"] > 0:
                    continue

                text = row["text"] or ""
                # Modern iMessages store text in attributedBody when `text` is NULL
                if not text.strip() and has_attributed_body and row["attributedBody"]:
                    text = decode_attributed_body(bytes(row["attributedBody"]))

                if not text.strip():
                    continue

                lines.append(text.strip())

            if len(lines) < min_messages:
                skipped += 1
                continue

            record = {"text": "\n".join(lines)}
            out_f.write(json.dumps(record, ensure_ascii=False) + "\n")
            written += 1

    conn.close()
    logger.info(f"Wrote {written} conversations to {output_path}")
    logger.info(f"Skipped {skipped} conversations with fewer than {min_messages} messages")


def main():
    parser = argparse.ArgumentParser(
        description="Export Apple iMessages to a JSONL file for pretraining"
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument(
        "--db-path",
        default=None,
        help="Path to a chat.db file directly (default: ~/Library/Messages/chat.db)",
    )
    source.add_argument(
        "--backup-path",
        default=None,
        help="Path to an iPhone backup directory to extract sms.db from "
             "(e.g. ~/Library/Application Support/MobileSync/Backup/<uuid>/)",
    )
    parser.add_argument(
        "--backup-password",
        default=None,
        help="Password for an encrypted iPhone backup (prompted interactively if omitted)",
    )
    parser.add_argument(
        "--output",
        default="data/imessages.jsonl",
        help="Path for the output JSONL file (default: data/imessages.jsonl)",
    )
    parser.add_argument(
        "--since",
        default=None,
        metavar="YYYY-MM-DD",
        help="Only include messages sent on or after this date (e.g. 2023-01-01)",
    )
    parser.add_argument(
        "--min-messages",
        type=int,
        default=2,
        help="Minimum number of messages for a conversation to be included (default: 2)",
    )
    args = parser.parse_args()

    tmp_file = None
    try:
        if args.backup_path:
            db_path, is_tmp = extract_chat_db_from_backup(args.backup_path, args.backup_password)
            if is_tmp:
                tmp_file = db_path
        else:
            db_path = args.db_path or "~/Library/Messages/chat.db"

        scrape_messages(
            db_path=db_path,
            output_path=args.output,
            min_messages=args.min_messages,
            since=args.since,
        )
    finally:
        if tmp_file:
            Path(tmp_file).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
