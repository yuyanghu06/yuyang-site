# yuyangGPT

A personal training pipeline for pretraining and fine-tuning Qwen 3.5-4B on custom datasets — including iMessages, documents, and structured conversations. Features LoRA/QLoRA optimization, encrypted iPhone backup support, and multi-GPU training.

---

## Setup

```bash
./scripts/setup.sh
```

Or manually:

```bash
python -m venv venv
source venv/bin/activate
pip install torch==2.1.2+cu121 --extra-index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

---

## Pipeline Overview

```
Raw data  →  scrape / extract  →  format  →  split  →  pretrain / finetune  →  merge  →  inference
```

---

## Data Scripts

### `scripts/scrape_imessages.py`

Scrapes your own iMessages into a JSONL file for pretraining. Reads directly from the macOS Messages database or from an iPhone backup (encrypted or unencrypted). Only exports messages sent by you.

**From the live macOS Messages database:**
```bash
python scripts/scrape_imessages.py --output data/imessages.jsonl
```

**From an iPhone backup (unencrypted):**
```bash
python scripts/scrape_imessages.py \
  --backup-path '~/Library/Application Support/MobileSync/Backup/<device-uuid>/' \
  --output data/imessages.jsonl
```

**From an encrypted iPhone backup:**
```bash
python scripts/scrape_imessages.py \
  --backup-path '~/Library/Application Support/MobileSync/Backup/<device-uuid>/' \
  --backup-password "yourpassword" \
  --output data/imessages.jsonl
```

You can pass the path to any file inside the backup and the script will auto-detect the backup root.

| Option | Default | Description |
|---|---|---|
| `--db-path` | `~/Library/Messages/chat.db` | Path to a `chat.db` file directly |
| `--backup-path` | — | Path to an iPhone backup directory (mutually exclusive with `--db-path`) |
| `--backup-password` | prompted | Password for an encrypted iPhone backup |
| `--output` | `data/imessages.jsonl` | Output JSONL file |
| `--since YYYY-MM-DD` | — | Only include messages sent on or after this date |
| `--min-messages` | `2` | Skip conversations with fewer messages than this |

---

### `scripts/format_imessages.py`

Flattens the iMessages JSONL for pretraining by replacing all newlines inside each record's text with spaces, so every conversation is a single unbroken line.

```bash
python scripts/format_imessages.py \
  --input data/imessages.jsonl \
  --output data/imessages_flat.jsonl
```

| Option | Default | Description |
|---|---|---|
| `--input` | `data/imessages.jsonl` | Input JSONL file |
| `--output` | `data/imessages_flat.jsonl` | Output JSONL file |

---

### `scripts/split_dataset.py`

Randomly splits any JSONL file into train and validation sets. Output files are written alongside the input with `_train` and `_val` suffixes.

```bash
python scripts/split_dataset.py --input data/imessages_flat.jsonl
# produces: data/imessages_flat_train.jsonl
#           data/imessages_flat_val.jsonl
```

| Option | Default | Description |
|---|---|---|
| `--input` | *(required)* | Input JSONL file |
| `--split` | `0.8` | Fraction of data for training (e.g. `0.9` for 90/10) |
| `--seed` | `0` | Random seed for reproducibility |

---

### `scripts/extract_text.py`

Extracts raw text from PDF, DOCX, Markdown, and TXT files into JSONL chunks for pretraining. Each output record contains the text chunk and the source file path.

```bash
python scripts/extract_text.py --input-dir data/docs/ --output data/docs.jsonl
```

Supported file types: `.pdf`, `.docx`, `.md`, `.txt`

| Option | Default | Description |
|---|---|---|
| `--input-dir` | *(required)* | Directory of documents to extract |
| `--output` | *(required)* | Output JSONL file |
| `--chunk-size` | `1000` | Approximate character length per chunk |

---

### `format_dataset.py`

Converts raw datasets (JSON/CSV) into user-assistant conversation format for fine-tuning.

```bash
python format_dataset.py input.json data/train.jsonl --format instruction
```

| Option | Default | Description |
|---|---|---|
| `input_file` | *(required)* | Input dataset file |
| `output_file` | *(required)* | Output JSONL file |
| `--format` | *(required)* | One of: `instruction`, `qa`, `conversation`, `text_pairs` |
| `--system-prompt` | — | Custom system prompt to inject |
| `--instruction-key` | `instruction` | Field name for the instruction |
| `--input-key` | `input` | Field name for the input |
| `--output-key` | `output` | Field name for the output |
| `--question-key` | `question` | Field name for the question |
| `--answer-key` | `answer` | Field name for the answer |
| `--conversation-key` | `conversation` | Field name for the conversation |

---

## Training

Both training scripts take a YAML config file. Example configs are in `config/`.

### `pretrain.py`

Pretrains the model on raw text using a causal language modelling objective. Use this with iMessages, document dumps, or any unstructured text JSONL.

```bash
python pretrain.py --config config/pretrain_config.yaml
```

**Resume from checkpoint:**
```bash
python pretrain.py --config config/pretrain_config.yaml --resume results/checkpoint-1000
```

| Option | Default | Description |
|---|---|---|
| `--config` | *(required)* | Path to YAML config file |
| `--resume` | — | Path to a checkpoint to resume from |
| `--output-dir` | from config | Override the output directory |
| `--streaming` | off | Use streaming datasets (for very large datasets) |
| `--wandb-disabled` | off | Disable Weights & Biases logging |

---

### `finetune.py`

Fine-tunes the model on structured conversation data using LoRA/QLoRA. Use this after pretraining, with formatted conversation JSONL.

```bash
python finetune.py --config config/finetune_config.yaml
```

**Resume from checkpoint:**
```bash
python finetune.py --config config/finetune_config.yaml --resume results/checkpoint-500
```

| Option | Default | Description |
|---|---|---|
| `--config` | *(required)* | Path to YAML config file |
| `--resume` | — | Path to a checkpoint to resume from |
| `--output-dir` | from config | Override the output directory |
| `--wandb-disabled` | off | Disable Weights & Biases logging |

**Launch scripts** (wraps the above with common cluster settings):
```bash
./scripts/launch_pretrain.sh
./scripts/launch_finetune.sh
```

---

## Inference & Deployment

### `scripts/live_inference.py`

Interactive chat with the trained model, using a system prompt from `prompts/system-prompt.md`.

```bash
python scripts/live_inference.py
```

```bash
python scripts/live_inference.py \
  --base-model Qwen/Qwen3.5-4B \
  --adapter-path pretrain_results/final_pretrained_model \
  --max-new-tokens 512 \
  --temperature 0.8
```

| Option | Default | Description |
|---|---|---|
| `--base-model` | `Qwen/Qwen3.5-4B` | Base model name or local path |
| `--adapter-path` | `pretrain_results/final_pretrained_model` | Path to the LoRA adapter |
| `--system-prompt` | `prompts/system-prompt.md` | Path to system prompt file |
| `--dtype` | `bfloat16` | Model precision: `bfloat16`, `float16`, `float32` |
| `--max-new-tokens` | `256` | Maximum tokens to generate per response |
| `--temperature` | `0.7` | Sampling temperature |
| `--top-p` | `0.9` | Top-p nucleus sampling |

---

### `scripts/merge_lora.py`

Merges a LoRA adapter into the base model weights to produce a single standalone model. Optionally pushes the result to Hugging Face Hub.

```bash
python scripts/merge_lora.py \
  --adapter-path pretrain_results/final_pretrained_model \
  --output-dir qwen-merged
```

**Push to Hugging Face Hub:**
```bash
python scripts/merge_lora.py \
  --adapter-path pretrain_results/final_pretrained_model \
  --output-dir qwen-merged \
  --push-to-hub \
  --repo-id username/yuyangGPT
```

| Option | Default | Description |
|---|---|---|
| `--base-model` | `Qwen/Qwen3.5-4B` | Base model name or local path |
| `--adapter-path` | `pretrain_results/final_pretrained_model` | Path to the LoRA adapter |
| `--output-dir` | `qwen-pretrained` | Directory to save the merged model |
| `--dtype` | `bfloat16` | Model precision: `bfloat16`, `float16`, `float32` |
| `--push-to-hub` | off | Push merged model to Hugging Face Hub |
| `--repo-id` | — | Hub repo ID, required with `--push-to-hub` |
| `--use-auth-token` | off | Use cached HF token for gated models |

---

## Utilities

### `utils.py`

General-purpose utilities: dataset validation, token counting, model testing, and sample generation.

**Validate a dataset:**
```bash
python utils.py validate data/train.jsonl
```

**Count tokens:**
```bash
python utils.py tokens data/train.jsonl --model Qwen/Qwen3.5-4B
```

**Test model generation:**
```bash
python utils.py test --config config/finetune_config.yaml --model results/final_model
```

**Generate a sample dataset:**
```bash
python utils.py sample data/sample.jsonl --num-samples 100
```

---

## Project Structure

```
yuyangGPT/
├── config/                  # YAML training configs
├── data/                    # Datasets (gitignored)
├── prompts/                 # System prompts
├── scripts/
│   ├── scrape_imessages.py  # Export iMessages to JSONL
│   ├── format_imessages.py  # Flatten newlines in iMessages JSONL
│   ├── split_dataset.py     # 80/20 train/val split
│   ├── extract_text.py      # PDF/DOCX/MD/TXT → JSONL
│   ├── live_inference.py    # Interactive chat with trained model
│   ├── merge_lora.py        # Merge LoRA adapter into base model
│   ├── launch_pretrain.sh   # Pretrain launch wrapper
│   ├── launch_finetune.sh   # Finetune launch wrapper
│   └── setup.sh             # Environment setup
├── pretrain.py              # Pretraining entrypoint
├── finetune.py              # Fine-tuning entrypoint
├── format_dataset.py        # Dataset format converter
├── model_setup.py           # Model/tokenizer/LoRA setup
├── data_processing.py       # Data loading and tokenisation
├── utils.py                 # Validation, token counting, testing
└── requirements.txt
```
