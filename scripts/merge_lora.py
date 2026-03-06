#!/usr/bin/env python3
"""
Merge LoRA adapter weights with the base Qwen 3.5-4B model and optionally push the merged model to Hugging Face Hub.
"""

import argparse
import os
import sys
from typing import Optional, Union

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge LoRA adapter weights into the base Qwen model.")
    parser.add_argument(
        "--base-model",
        type=str,
        default="Qwen/Qwen3.5-4B",
        help="Base model name or path (e.g., Qwen/Qwen3.5-4B).",
    )
    parser.add_argument(
        "--adapter-path",
        type=str,
        default=os.path.join("pretrain_results", "final_pretrained_model"),
        help="Path to the LoRA adapter weights (folder containing adapter_config.json).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="qwen-pretrained",
        help="Directory to save the merged model.",
    )
    parser.add_argument(
        "--dtype",
        choices=["bfloat16", "float16", "float32"],
        default="bfloat16",
        help="Torch dtype to use when loading the base model.",
    )
    parser.add_argument(
        "--use-auth-token",
        action="store_true",
        help="Use your cached Hugging Face token (needed for gated models).",
    )
    parser.add_argument(
        "--push-to-hub",
        action="store_true",
        help="If set, push the merged model to Hugging Face Hub.",
    )
    parser.add_argument(
        "--repo-id",
        type=str,
        help="Hugging Face repository id to push to (e.g., username/qwen3.5-4b-merged). Required with --push-to-hub.",
    )
    return parser.parse_args()


def get_dtype(dtype_name: str) -> torch.dtype:
    mapping = {
        "bfloat16": torch.bfloat16,
        "float16": torch.float16,
        "float32": torch.float32,
    }
    return mapping[dtype_name]


def load_base_model(model_name: str, dtype: torch.dtype, token: Optional[Union[str, bool]]) -> AutoModelForCausalLM:
    return AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
        token=token,
    )


def load_tokenizer(model_name: str, token: Optional[Union[str, bool]]) -> AutoTokenizer:
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        token=token,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    return tokenizer


def main():
    args = parse_args()

    if not os.path.isdir(args.adapter_path):
        sys.exit(f"Adapter path not found: {args.adapter_path}")
    adapter_config_path = os.path.join(args.adapter_path, "adapter_config.json")
    if not os.path.isfile(adapter_config_path):
        sys.exit(
            f"adapter_config.json not found in {args.adapter_path}. "
            "Point --adapter-path to the LoRA adapter folder (e.g., a checkpoint dir that contains adapter_config.json)."
        )

    dtype = get_dtype(args.dtype)
    hf_token: Optional[Union[str, bool]] = True if args.use_auth_token else None

    print(f"Loading base model: {args.base_model}")
    base_model = load_base_model(args.base_model, dtype, hf_token)

    print(f"Loading tokenizer from base model: {args.base_model}")
    tokenizer = load_tokenizer(args.base_model, hf_token)

    print(f"Loading LoRA adapter from: {args.adapter_path}")
    lora_model = PeftModel.from_pretrained(base_model, args.adapter_path, token=hf_token)

    print("Merging LoRA weights into the base model...")
    merged_model = lora_model.merge_and_unload()
    merged_model = merged_model.to("cpu")

    os.makedirs(args.output_dir, exist_ok=True)
    print(f"Saving merged model to: {args.output_dir}")
    merged_model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    if args.push_to_hub:
        if not args.repo_id:
            sys.exit("Please provide --repo-id when using --push-to-hub.")
        print(f"Pushing merged model to Hugging Face Hub: {args.repo_id}")
        merged_model.push_to_hub(args.repo_id, token=hf_token)
        tokenizer.push_to_hub(args.repo_id, token=hf_token)
        print("Push to Hugging Face Hub complete.")

    print(f"Done. Merged model is ready at {args.output_dir}.")


if __name__ == "__main__":
    main()
