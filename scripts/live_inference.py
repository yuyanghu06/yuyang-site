#!/usr/bin/env python3
"""
Interactive inference with Qwen 3.5-4B + LoRA adapter, injecting a system prompt from prompts/system-prompt.md.
"""

import argparse
import os
import sys
from typing import Optional, Union, List, Dict

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run interactive inference with a Qwen LoRA adapter.")
    parser.add_argument(
        "--base-model",
        type=str,
        default="Qwen/Qwen3.5-4B",
        help="Base model name or path.",
    )
    parser.add_argument(
        "--adapter-path",
        type=str,
        default=os.path.join("pretrain_results", "final_pretrained_model"),
        help="Path to the LoRA adapter (folder containing adapter_config.json).",
    )
    parser.add_argument(
        "--system-prompt",
        type=str,
        default=os.path.join("prompts", "system-prompt.md"),
        help="Path to system prompt markdown file.",
    )
    parser.add_argument(
        "--dtype",
        choices=["bfloat16", "float16", "float32"],
        default="bfloat16",
        help="Torch dtype to load the base model.",
    )
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        default=256,
        help="Maximum new tokens to generate.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Sampling temperature.",
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=0.9,
        help="Top-p nucleus sampling.",
    )
    parser.add_argument(
        "--use-auth-token",
        action="store_true",
        help="Use your cached Hugging Face token (for gated models).",
    )
    return parser.parse_args()


def get_dtype(dtype_name: str) -> torch.dtype:
    mapping = {
        "bfloat16": torch.bfloat16,
        "float16": torch.float16,
        "float32": torch.float32,
    }
    return mapping[dtype_name]


def load_system_prompt(path: str) -> str:
    if not os.path.isfile(path):
        sys.exit(f"System prompt file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def load_model_and_tokenizer(
    base_model: str,
    adapter_path: str,
    dtype: torch.dtype,
    token: Optional[Union[str, bool]],
):
    if not os.path.isdir(adapter_path):
        sys.exit(f"Adapter path not found: {adapter_path}")
    adapter_config = os.path.join(adapter_path, "adapter_config.json")
    if not os.path.isfile(adapter_config):
        sys.exit(f"adapter_config.json not found in adapter path: {adapter_path}")

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
        token=token,
    )

    tokenizer = AutoTokenizer.from_pretrained(
        base_model,
        trust_remote_code=True,
        token=token,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = PeftModel.from_pretrained(model, adapter_path, token=token)
    return model, tokenizer


def build_messages(system_prompt: str, user_text: str) -> List[Dict[str, str]]:
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_text},
    ]


def generate_response(
    model,
    tokenizer,
    messages: List[Dict[str, str]],
    max_new_tokens: int,
    temperature: float,
    top_p: float,
):
    device = model.device
    prompt = tokenizer.apply_chat_template(messages, tokenize=False)
    inputs = tokenizer(prompt, return_tensors="pt").to(device)

    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=temperature,
            top_p=top_p,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    generated = output[0][inputs["input_ids"].shape[-1] :]
    return tokenizer.decode(generated, skip_special_tokens=True)


def main():
    args = parse_args()

    dtype = get_dtype(args.dtype)
    hf_token: Optional[Union[str, bool]] = True if args.use_auth_token else None

    system_prompt = load_system_prompt(args.system_prompt)
    model, tokenizer = load_model_and_tokenizer(args.base_model, args.adapter_path, dtype, hf_token)
    model.eval()

    print("Loaded model and adapter. Type your prompt (empty line or Ctrl+C to exit).")
    while True:
        try:
            user_text = input("User> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            break
        if not user_text:
            print("Goodbye.")
            break

        messages = build_messages(system_prompt, user_text)
        response = generate_response(
            model,
            tokenizer,
            messages,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
        )
        print(f"Assistant> {response}\n")


if __name__ == "__main__":
    main()
