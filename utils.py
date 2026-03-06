#!/usr/bin/env python3
"""
Utility script for common operations with Qwen training.
"""

import argparse
import json
import yaml
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

from model_setup import ModelSetup, load_config
from format_dataset import DatasetFormatter


def test_model_generation(config_path: str, model_path: str = None, prompt: str = None):
    """Test model generation with a given prompt."""
    config = load_config(config_path)
    
    if model_path:
        # Load from saved model
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=torch.bfloat16)
    else:
        # Load base model
        setup = ModelSetup(config)
        model, tokenizer, _ = setup.setup_complete()
    
    if prompt is None:
        prompt = "The future of artificial intelligence is"
    
    # Format as conversation if needed
    messages = [{"role": "user", "content": prompt}]
    formatted_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    # Generate
    inputs = tokenizer(formatted_prompt, return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=200,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id
        )
    
    generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    print(f"Prompt: {prompt}")
    print(f"Generated: {generated_text}")


def validate_dataset(dataset_path: str):
    """Validate that a dataset is properly formatted."""
    print(f"Validating dataset: {dataset_path}")
    
    with open(dataset_path, 'r') as f:
        if dataset_path.endswith('.jsonl'):
            samples = []
            for i, line in enumerate(f):
                try:
                    sample = json.loads(line.strip())
                    samples.append(sample)
                    if i >= 10:  # Check first 10 samples
                        break
                except json.JSONDecodeError as e:
                    print(f"JSON decode error on line {i+1}: {e}")
                    return False
        else:
            try:
                samples = json.load(f)
                if isinstance(samples, dict):
                    samples = [samples]
                samples = samples[:10]  # Check first 10 samples
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                return False
    
    # Check sample format
    valid_samples = 0
    for i, sample in enumerate(samples):
        if "messages" in sample:
            messages = sample["messages"]
            if isinstance(messages, list) and len(messages) >= 2:
                # Check if messages have proper structure
                valid_message = True
                for msg in messages:
                    if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                        valid_message = False
                        break
                if valid_message:
                    valid_samples += 1
                else:
                    print(f"Sample {i}: Invalid message structure")
            else:
                print(f"Sample {i}: Messages should be a list with at least 2 items")
        else:
            print(f"Sample {i}: Missing 'messages' field")
    
    print(f"Valid samples: {valid_samples}/{len(samples)}")
    return valid_samples == len(samples)


def count_tokens(dataset_path: str, model_name: str = "Qwen/Qwen3.5-4B"):
    """Count tokens in a dataset."""
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    
    total_tokens = 0
    sample_count = 0
    
    with open(dataset_path, 'r') as f:
        if dataset_path.endswith('.jsonl'):
            for line in f:
                sample = json.loads(line.strip())
                if "messages" in sample:
                    formatted = tokenizer.apply_chat_template(
                        sample["messages"],
                        tokenize=False,
                        add_generation_prompt=False
                    )
                    tokens = tokenizer.encode(formatted)
                    total_tokens += len(tokens)
                    sample_count += 1
        else:
            data = json.load(f)
            if isinstance(data, dict):
                data = [data]
            for sample in data:
                if "messages" in sample:
                    formatted = tokenizer.apply_chat_template(
                        sample["messages"],
                        tokenize=False,
                        add_generation_prompt=False
                    )
                    tokens = tokenizer.encode(formatted)
                    total_tokens += len(tokens)
                    sample_count += 1
    
    avg_tokens = total_tokens / sample_count if sample_count > 0 else 0
    print(f"Dataset: {dataset_path}")
    print(f"Samples: {sample_count}")
    print(f"Total tokens: {total_tokens:,}")
    print(f"Average tokens per sample: {avg_tokens:.1f}")


def create_sample_dataset(output_path: str, num_samples: int = 100):
    """Create a sample dataset for testing."""
    print(f"Creating sample dataset with {num_samples} samples...")
    
    sample_conversations = [
        {
            "messages": [
                {"role": "user", "content": f"What is {i + 1} + {i + 2}?"},
                {"role": "assistant", "content": f"{i + 1} + {i + 2} = {2*i + 3}"}
            ]
        }
        for i in range(num_samples)
    ]
    
    # Add variety
    sample_conversations.extend([
        {
            "messages": [
                {"role": "user", "content": "Explain the concept of machine learning."},
                {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed."}
            ]
        },
        {
            "messages": [
                {"role": "user", "content": "Write a short poem about technology."},
                {"role": "assistant", "content": "In circuits bright and silicon dreams,\nWhere data flows in endless streams,\nTechnology weaves its magic spell,\nA future story yet to tell."}
            ]
        }
    ])
    
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        for sample in sample_conversations:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')
    
    print(f"Sample dataset created: {output_path}")
    print(f"Total samples: {len(sample_conversations)}")


def main():
    parser = argparse.ArgumentParser(description="Qwen training utilities")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Test generation
    test_parser = subparsers.add_parser('test', help='Test model generation')
    test_parser.add_argument('--config', required=True, help='Config file')
    test_parser.add_argument('--model', help='Path to trained model (optional)')
    test_parser.add_argument('--prompt', help='Test prompt')
    
    # Validate dataset
    validate_parser = subparsers.add_parser('validate', help='Validate dataset format')
    validate_parser.add_argument('dataset', help='Dataset file path')
    
    # Count tokens
    tokens_parser = subparsers.add_parser('tokens', help='Count tokens in dataset')
    tokens_parser.add_argument('dataset', help='Dataset file path')
    tokens_parser.add_argument('--model', default='Qwen/Qwen3.5-4B', help='Model for tokenization')
    
    # Create sample
    sample_parser = subparsers.add_parser('sample', help='Create sample dataset')
    sample_parser.add_argument('output', help='Output file path')
    sample_parser.add_argument('--num-samples', type=int, default=100, help='Number of samples')
    
    args = parser.parse_args()
    
    if args.command == 'test':
        test_model_generation(args.config, args.model, args.prompt)
    elif args.command == 'validate':
        validate_dataset(args.dataset)
    elif args.command == 'tokens':
        count_tokens(args.dataset, args.model)
    elif args.command == 'sample':
        create_sample_dataset(args.output, args.num_samples)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
