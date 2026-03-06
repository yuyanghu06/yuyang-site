# Qwen 3.5-4B Fine-tuning Infrastructure

A complete training infrastructure for fine-tuning and pretraining Qwen 3.5-4B models with custom datasets. Features LoRA/QLoRA optimization, multi-GPU support, and comprehensive evaluation tools.

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Run the setup script
./scripts/setup.sh

# Or manually:
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
# Install CUDA-enabled PyTorch first (example for CUDA 12.1 on Windows)
pip install torch==2.1.2+cu121 --extra-index-url https://download.pytorch.org/whl/cu121
# Then install the rest
pip install -r requirements.txt

# (Optional) Install flash-attn after torch if your GPU/driver supports it
# pip install flash-attn --no-build-isolation
```

### 2. Prepare Your Dataset
```bash
# Convert your dataset to conversation format
python format_dataset.py input.json data/train.jsonl --format instruction

# Validate the formatted dataset
python utils.py validate data/train.jsonl

# Count tokens (optional)
python utils.py tokens data/train.jsonl
```

### 3. Fine-tune the Model
```bash
# Quick fine-tuning with default settings
./scripts/launch_finetune.sh

# Or with custom configuration
python finetune.py --config config/finetune_config.yaml
```

### 4. Test Your Model
```bash
# Test generation capabilities
python utils.py test --config config/finetune_config.yaml --model results/final_model
```

## 📁 Project Structure

```
├── config/                     # Configuration files
│   ├── finetune_config.yaml   # Fine-tuning configuration
│   └── pretrain_config.yaml   # Pretraining configuration
├── scripts/                    # Utility scripts
│   ├── setup.sh               # Environment setup
│   ├── launch_finetune.sh     # Fine-tuning launcher
│   └── launch_pretrain.sh     # Pretraining launcher
├── format_dataset.py          # Dataset formatting script
├── model_setup.py             # Model and LoRA configuration
├── data_processing.py         # Data loading and preprocessing
├── finetune.py               # Fine-tuning script
├── pretrain.py               # Pretraining script
├── utils.py                  # Utility functions
└── requirements.txt          # Python dependencies
```

### Sample file layout on disk

```
.
├── config/
│   ├── finetune_config.yaml
│   └── pretrain_config.yaml
├── data/
│   ├── train.jsonl            # formatted conversations for fine-tuning
│   ├── validation.jsonl       # optional held-out set
│   ├── pretrain.jsonl         # raw text with `"text"` field for pretraining
│   └── pretrain_val.jsonl     # optional pretraining eval set
├── results/                   # fine-tuning outputs (checkpoints, logs)
├── pretrain_results/          # pretraining outputs
├── scripts/
├── format_dataset.py
├── data_processing.py
├── finetune.py
├── pretrain.py
├── utils.py
└── README.md
```

## 🔧 Core Components

### Dataset Formatting (`format_dataset.py`)
Converts various dataset formats into conversation format:

```bash
# Instruction-following format (Alpaca-style)
python format_dataset.py input.json output.jsonl --format instruction

# Q&A format
python format_dataset.py input.json output.jsonl --format qa --question-key question --answer-key answer

# Existing conversation format
python format_dataset.py input.json output.jsonl --format conversation

# Simple text pairs
python format_dataset.py input.json output.jsonl --format text_pairs --input-key input --target-key target
```

**Expected Input Formats:**
- **Instruction**: `{"instruction": "...", "input": "...", "output": "..."}`
- **Q&A**: `{"question": "...", "answer": "..."}`
- **Conversation**: `{"conversation": [{"role": "user", "content": "..."}, ...]}`
- **Text pairs**: `{"input": "...", "target": "..."}`

### Fine-tuning (`finetune.py`)
Complete fine-tuning pipeline with:
- LoRA/QLoRA for parameter-efficient training
- 4-bit quantization for memory efficiency
- Gradient checkpointing and mixed precision
- Wandb integration for experiment tracking
- Evaluation and sample generation

```bash
python finetune.py --config config/finetune_config.yaml [OPTIONS]

Options:
  --resume CHECKPOINT     # Resume from checkpoint
  --output-dir DIR        # Override output directory
  --wandb-disabled        # Disable wandb logging
```

### Pretraining (`pretrain.py`)
Continued pretraining on raw text data:
- Handles large-scale text datasets
- Streaming dataset support
- Perplexity monitoring
- Regular generation sampling

```bash
python pretrain.py --config config/pretrain_config.yaml [OPTIONS]

Options:
  --streaming             # Use streaming datasets
  --resume CHECKPOINT     # Resume from checkpoint
  --output-dir DIR        # Override output directory
  --wandb-disabled        # Disable wandb logging
```

## ⚙️ Configuration

### Fine-tuning Configuration (`config/finetune_config.yaml`)

Key settings to customize:

```yaml
# Model settings
model:
  name: "Qwen/Qwen3.5-4B"
  use_flash_attention: true

# LoRA settings
lora:
  enabled: true
  r: 64                    # LoRA rank
  alpha: 16               # LoRA alpha
  target_modules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]

# Training settings
training:
  per_device_train_batch_size: 1
  gradient_accumulation_steps: 8
  learning_rate: 2e-4
  num_train_epochs: 3

# Data settings
data:
  train_file: "data/train.jsonl"
  max_seq_length: 2048
```

### Memory Optimization

For different GPU memory configurations:

**Low Memory (8GB)**:
```yaml
quantization:
  enabled: true
  load_in_4bit: true
training:
  per_device_train_batch_size: 1
  gradient_accumulation_steps: 8
lora:
  r: 32
  alpha: 8
```

**Medium Memory (16GB)**:
```yaml
quantization:
  enabled: true
  load_in_4bit: true
training:
  per_device_train_batch_size: 2
  gradient_accumulation_steps: 4
lora:
  r: 64
  alpha: 16
```

**High Memory (24GB+)**:
```yaml
quantization:
  enabled: false
training:
  per_device_train_batch_size: 4
  gradient_accumulation_steps: 2
lora:
  r: 128
  alpha: 32
```

## 🗃️ Dataset Preparation Examples

### Extract raw documents (PDF/DOCX/MD/TXT) to JSONL for pretraining

Place source files under `data/raw_docs/` (or any folder), then run:

```bash
python scripts/extract_text.py --input-dir data/raw_docs --output-file data/pretrain.jsonl --chunk-size 2000 --overlap 200
```

This writes JSONL with `text` (and `source`) fields that can be pointed to by `data.train_file` in `config/pretrain_config.yaml`.

> Note: Ensure your local CUDA toolkit/driver matches the PyTorch build (e.g., cu121) you install above.

### Example 1: Alpaca-style Instruction Dataset
Input format:
```json
[
  {
    "instruction": "Explain quantum computing",
    "input": "",
    "output": "Quantum computing is a revolutionary approach..."
  }
]
```

Conversion:
```bash
python format_dataset.py alpaca_data.json data/train.jsonl --format instruction
```

### Example 2: Q&A Dataset
Input format:
```json
[
  {
    "question": "What is machine learning?",
    "answer": "Machine learning is a subset of AI..."
  }
]
```

Conversion:
```bash
python format_dataset.py qa_data.json data/train.jsonl --format qa
```

### Example 3: Custom Conversation Dataset
Input format:
```json
[
  {
    "conversation": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"},
      {"role": "assistant", "content": "Hi! How can I help you today?"}
    ]
  }
]
```

Conversion:
```bash
python format_dataset.py conversation_data.json data/train.jsonl --format conversation
```

## 🎯 Training Examples

### Basic Fine-tuning
```bash
# Prepare sample dataset
python utils.py sample data/sample_train.jsonl --num-samples 1000

# Fine-tune with default settings
python finetune.py --config config/finetune_config.yaml
```

### Advanced Fine-tuning with Custom Settings
```bash
# Create custom config
cp config/finetune_config.yaml config/my_config.yaml
# Edit my_config.yaml with your settings

# Run training with custom output directory
python finetune.py --config config/my_config.yaml --output-dir results/my_experiment
```

### Multi-GPU Training
For multi-GPU training, use `accelerate`:
```bash
# Configure accelerate (run once)
accelerate config

# Launch multi-GPU training
accelerate launch finetune.py --config config/finetune_config.yaml
```

### Pretraining Example
```bash
# Prepare text data in JSONL format with "text" field
echo '{"text": "Your raw text data here..."}' > data/pretrain.jsonl

# Run pretraining
python pretrain.py --config config/pretrain_config.yaml --streaming
```

## 🧩 Merge LoRA and export

After pretraining or fine-tuning with LoRA, merge the adapter into the base model and save to `qwen-pretrained`:

```bash
python scripts\merge_lora.py --adapter-path pretrain_results\final_pretrained_model --base-model Qwen/Qwen3.5-4B --output-dir qwen-pretrained
```

> Note: `--adapter-path` must point to a folder containing `adapter_config.json` (e.g., a LoRA checkpoint directory).

To push the merged weights to Hugging Face Hub for inference elsewhere (after `huggingface-cli login`):

```bash
python scripts\merge_lora.py --adapter-path pretrain_results\final_pretrained_model --base-model Qwen/Qwen3.5-4B --output-dir qwen-pretrained --push-to-hub --repo-id your-username/qwen3.5-4b-merged --use-auth-token
```

You can then load the merged model locally or from the Hub with `AutoModelForCausalLM.from_pretrained("qwen-pretrained")` (or the Hub repo id) along with `AutoTokenizer.from_pretrained`.

## 📊 Evaluation and Monitoring

### Wandb Integration
1. Install wandb: `pip install wandb`
2. Login: `wandb login`
3. Set project name in config:
```yaml
environment:
  wandb_project: "my-qwen-experiments"
```

### Model Testing
```bash
# Test generation with trained model
python utils.py test --config config/finetune_config.yaml --model results/final_model --prompt "Explain artificial intelligence"

# Validate dataset format
python utils.py validate data/train.jsonl

# Count tokens in dataset
python utils.py tokens data/train.jsonl
```

## 🔍 Troubleshooting

### Common Issues

**1. CUDA Out of Memory**
- Reduce `per_device_train_batch_size`
- Increase `gradient_accumulation_steps`
- Enable quantization: `quantization.enabled: true`
- Reduce LoRA rank: `lora.r: 32`

**2. Model Loading Issues**
- Verify model name in config
- Check HuggingFace token if using gated models
- Ensure sufficient disk space

**3. Dataset Format Errors**
- Validate dataset: `python utils.py validate data/train.jsonl`
- Check conversation structure in formatted data
- Ensure UTF-8 encoding

**4. Training Instability**
- Reduce learning rate: `learning_rate: 1e-4`
- Add gradient clipping: `max_grad_norm: 1.0`
- Use warmup: `warmup_ratio: 0.03`

### Performance Tips

1. **Use Flash Attention**: Set `model.use_flash_attention: true`
2. **Optimize Data Loading**: Increase `preprocessing_num_workers`
3. **Mixed Precision**: Enable `bf16: true` for newer GPUs
4. **Gradient Checkpointing**: Enable to save memory
5. **Streaming Datasets**: Use for very large pretraining datasets

## 📝 Model Updates

The default configuration targets `Qwen/Qwen3.5-4B`. To switch to another variant, update the `model.name` field (e.g., to an Instruct checkpoint) and the rest of the pipeline will adapt automatically.

## 🤝 Contributing

Feel free to submit issues and enhancement requests! This infrastructure is designed to be modular and extensible.

## 📄 License

This project is open source. Please check the individual model licenses (Qwen models have their own licensing terms).
