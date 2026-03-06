#!/bin/bash
# Quick setup script for Qwen fine-tuning environment

echo "Setting up Qwen fine-tuning environment..."

# Create necessary directories
mkdir -p data results logs config

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Setup complete!"
echo ""
echo "To activate the environment, run:"
echo "source venv/bin/activate"
echo ""
echo "Example usage:"
echo "1. Format your dataset:"
echo "   python format_dataset.py input.json data/train.jsonl --format instruction"
echo ""
echo "2. Run fine-tuning:"
echo "   python finetune.py --config config/finetune_config.yaml"
echo ""
echo "3. Run pretraining:"
echo "   python pretrain.py --config config/pretrain_config.yaml"