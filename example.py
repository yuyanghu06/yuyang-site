#!/usr/bin/env python3
"""
Example usage of the Qwen fine-tuning infrastructure.
This script demonstrates the complete workflow from dataset creation to model training.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

def create_example_dataset():
    """Create a small example dataset for demonstration."""
    print("Creating example dataset...")
    
    # Sample instruction-following data
    sample_data = [
        {
            "instruction": "Explain the concept of machine learning in simple terms.",
            "input": "",
            "output": "Machine learning is like teaching a computer to learn patterns from examples, just like how humans learn from experience. Instead of programming specific rules, we show the computer lots of examples and let it figure out the patterns on its own."
        },
        {
            "instruction": "Write a Python function to calculate the factorial of a number.",
            "input": "",
            "output": """Here's a Python function to calculate factorial:

```python
def factorial(n):
    if n == 0 or n == 1:
        return 1
    else:
        return n * factorial(n - 1)

# Example usage
print(factorial(5))  # Output: 120
```

This function uses recursion to calculate the factorial by multiplying n with the factorial of (n-1)."""
        },
        {
            "instruction": "Summarize the given text.",
            "input": "Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of 'intelligent agents': any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals.",
            "output": "AI refers to machine intelligence that allows devices to perceive their environment and take goal-oriented actions, contrasting with natural intelligence found in humans and animals."
        },
        {
            "instruction": "Convert the temperature from Celsius to Fahrenheit.",
            "input": "25°C",
            "output": "25°C converted to Fahrenheit is 77°F. The formula used is: F = (C × 9/5) + 32, so (25 × 9/5) + 32 = 45 + 32 = 77°F."
        },
        {
            "instruction": "Explain what a neural network is.",
            "input": "",
            "output": "A neural network is a computational model inspired by biological neural networks in animal brains. It consists of interconnected nodes (neurons) organized in layers. Each connection has a weight, and the network learns by adjusting these weights based on training data. Neural networks can recognize patterns, classify data, and make predictions."
        }
    ]
    
    # Create additional samples by varying the existing ones
    extended_data = sample_data.copy()
    
    # Add more math problems
    for i in range(10, 20):
        extended_data.append({
            "instruction": f"What is {i} multiplied by {i+1}?",
            "input": "",
            "output": f"{i} × {i+1} = {i * (i+1)}"
        })
    
    # Add more programming questions
    programming_topics = ["variables", "loops", "functions", "classes", "inheritance"]
    for topic in programming_topics:
        extended_data.append({
            "instruction": f"Explain {topic} in Python programming.",
            "input": "",
            "output": f"{topic.capitalize()} in Python are fundamental concepts used for organizing and structuring code effectively."
        })
    
    # Save as JSON file
    os.makedirs("data", exist_ok=True)
    with open("data/example_raw.json", "w", encoding="utf-8") as f:
        json.dump(extended_data, f, indent=2, ensure_ascii=False)
    
    print(f"Created example dataset with {len(extended_data)} samples")
    return "data/example_raw.json"


def format_dataset(input_file, output_file):
    """Format the raw dataset into conversation format."""
    print(f"Formatting dataset from {input_file} to {output_file}")
    
    cmd = [
        sys.executable, "format_dataset.py",
        input_file, output_file,
        "--format", "instruction"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error formatting dataset: {result.stderr}")
        return False
    
    print("Dataset formatted successfully")
    return True


def validate_setup():
    """Validate that all required files are present."""
    required_files = [
        "finetune.py",
        "model_setup.py",
        "data_processing.py",
        "config/finetune_config.yaml",
        "requirements.txt"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("Missing required files:")
        for file in missing_files:
            print(f"  - {file}")
        return False
    
    print("All required files are present")
    return True


def run_quick_test():
    """Run a quick test of the training pipeline."""
    print("Running quick test (dry run)...")
    
    # Create a minimal config for testing
    test_config = {
        "model": {
            "name": "Qwen/Qwen2.5-3B",
            "trust_remote_code": True,
            "use_flash_attention": False
        },
        "quantization": {
            "enabled": True,
            "load_in_4bit": True,
            "bnb_4bit_compute_dtype": "bfloat16",
            "bnb_4bit_use_double_quant": True,
            "bnb_4bit_quant_type": "nf4"
        },
        "lora": {
            "enabled": True,
            "r": 8,
            "alpha": 4,
            "dropout": 0.05,
            "bias": "none",
            "target_modules": ["q_proj", "v_proj"]
        },
        "training": {
            "output_dir": "./test_results",
            "num_train_epochs": 1,
            "per_device_train_batch_size": 1,
            "gradient_accumulation_steps": 2,
            "learning_rate": 2e-4,
            "max_steps": 5,  # Very short test
            "logging_steps": 1,
            "save_steps": 10,
            "bf16": True,
            "gradient_checkpointing": True,
            "report_to": []  # Disable wandb for test
        },
        "data": {
            "train_file": "data/example_formatted.jsonl",
            "max_seq_length": 512
        },
        "environment": {
            "seed": 42
        }
    }
    
    # Save test config
    os.makedirs("config", exist_ok=True)
    import yaml
    with open("config/test_config.yaml", "w") as f:
        yaml.dump(test_config, f, default_flow_style=False)
    
    print("Test configuration created")
    print("To run the actual test, execute:")
    print("python finetune.py --config config/test_config.yaml --wandb-disabled")


def main():
    print("🚀 Qwen Fine-tuning Infrastructure Example")
    print("=" * 50)
    
    # Step 1: Validate setup
    if not validate_setup():
        print("❌ Setup validation failed. Please ensure all files are present.")
        return
    
    print("✅ Setup validation passed")
    
    # Step 2: Create example dataset
    try:
        raw_dataset = create_example_dataset()
        print("✅ Example dataset created")
    except Exception as e:
        print(f"❌ Failed to create dataset: {e}")
        return
    
    # Step 3: Format dataset
    try:
        success = format_dataset(raw_dataset, "data/example_formatted.jsonl")
        if not success:
            return
        print("✅ Dataset formatted successfully")
    except Exception as e:
        print(f"❌ Failed to format dataset: {e}")
        return
    
    # Step 4: Validate formatted dataset
    try:
        cmd = [sys.executable, "utils.py", "validate", "data/example_formatted.jsonl"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Formatted dataset validation passed")
            print(result.stdout)
        else:
            print(f"❌ Dataset validation failed: {result.stderr}")
    except Exception as e:
        print(f"❌ Failed to validate dataset: {e}")
    
    # Step 5: Count tokens
    try:
        cmd = [sys.executable, "utils.py", "tokens", "data/example_formatted.jsonl"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Token counting completed")
            print(result.stdout)
    except Exception as e:
        print(f"❌ Failed to count tokens: {e}")
    
    # Step 6: Create test configuration
    try:
        run_quick_test()
        print("✅ Test configuration created")
    except Exception as e:
        print(f"❌ Failed to create test config: {e}")
    
    print("\n🎉 Example setup completed successfully!")
    print("\nNext steps:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Run a quick test: python finetune.py --config config/test_config.yaml --wandb-disabled")
    print("3. For full training, modify config/finetune_config.yaml and use your dataset")
    print("4. Launch training: ./scripts/launch_finetune.sh")
    
    print("\nFiles created:")
    print("- data/example_raw.json (original dataset)")
    print("- data/example_formatted.jsonl (formatted for training)")
    print("- config/test_config.yaml (test configuration)")


if __name__ == "__main__":
    main()