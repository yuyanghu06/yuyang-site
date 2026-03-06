#!/usr/bin/env python3
"""
Model setup utilities for Qwen 3.5-4B fine-tuning and pretraining.
Handles model loading, quantization, and LoRA configuration.
"""

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import logging
from typing import Optional, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelSetup:
    """Handles model and tokenizer setup for Qwen training."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model = None
        self.tokenizer = None
        
    def setup_tokenizer(self) -> AutoTokenizer:
        """Setup and configure tokenizer."""
        logger.info(f"Loading tokenizer: {self.config['model']['name']}")
        
        tokenizer = AutoTokenizer.from_pretrained(
            self.config['model']['name'],
            trust_remote_code=self.config['model'].get('trust_remote_code', True)
        )
        
        # Add special tokens if needed
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
            
        # Configure chat template for Qwen
        if not hasattr(tokenizer, 'chat_template') or tokenizer.chat_template is None:
            tokenizer.chat_template = (
                "{% for message in messages %}"
                "{% if message['role'] == 'system' %}"
                "<|im_start|>system\n{{ message['content'] }}<|im_end|>\n"
                "{% elif message['role'] == 'user' %}"
                "<|im_start|>user\n{{ message['content'] }}<|im_end|>\n"
                "{% elif message['role'] == 'assistant' %}"
                "<|im_start|>assistant\n{{ message['content'] }}<|im_end|>\n"
                "{% endif %}"
                "{% endfor %}"
                "{% if add_generation_prompt %}"
                "<|im_start|>assistant\n"
                "{% endif %}"
            )
        
        self.tokenizer = tokenizer
        return tokenizer
    
    def setup_quantization_config(self) -> Optional[BitsAndBytesConfig]:
        """Setup quantization configuration."""
        if not self.config['quantization']['enabled']:
            return None
            
        logger.info("Setting up 4-bit quantization")
        
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=self.config['quantization']['load_in_4bit'],
            bnb_4bit_compute_dtype=getattr(torch, self.config['quantization']['bnb_4bit_compute_dtype']),
            bnb_4bit_use_double_quant=self.config['quantization']['bnb_4bit_use_double_quant'],
            bnb_4bit_quant_type=self.config['quantization']['bnb_4bit_quant_type']
        )
        
        return quantization_config
    
    def setup_model(self, quantization_config: Optional[BitsAndBytesConfig] = None) -> AutoModelForCausalLM:
        """Setup and configure model."""
        logger.info(f"Loading model: {self.config['model']['name']}")
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        model_kwargs = {
            'trust_remote_code': self.config['model'].get('trust_remote_code', True),
            'torch_dtype': torch.bfloat16,
        }
        
        if quantization_config is not None:
            model_kwargs['quantization_config'] = quantization_config
            model_kwargs['device_map'] = "auto"
        
        # Add flash attention if available and requested
        if self.config['model'].get('use_flash_attention', False):
            try:
                import flash_attn  # noqa: F401
                model_kwargs['attn_implementation'] = "flash_attention_2"
                logger.info("Using Flash Attention 2")
            except Exception as e:
                logger.warning(f"Flash Attention not available, falling back to default attention: {e}")
        
        model = AutoModelForCausalLM.from_pretrained(
            self.config['model']['name'],
            **model_kwargs
        )
        
        # Prepare model for training
        if quantization_config is not None:
            model = prepare_model_for_kbit_training(model)
        elif torch.cuda.is_available():
            model = model.to(device)
            logger.info(f"Model moved to CUDA device: {device}")
        else:
            logger.info("CUDA not available, using CPU for model.")

        # Enable gradient checkpointing if specified
        if self.config['training'].get('gradient_checkpointing', False):
            model.gradient_checkpointing_enable()
        
        self.model = model
        return model
    
    def setup_lora_config(self) -> Optional[LoraConfig]:
        """Setup LoRA configuration."""
        if not self.config['lora']['enabled']:
            return None
            
        logger.info("Setting up LoRA configuration")
        
        lora_config = LoraConfig(
            r=self.config['lora']['r'],
            lora_alpha=self.config['lora']['alpha'],
            lora_dropout=self.config['lora']['dropout'],
            bias=self.config['lora']['bias'],
            target_modules=self.config['lora']['target_modules'],
            task_type="CAUSAL_LM"
        )
        
        return lora_config
    
    def apply_lora(self, model: AutoModelForCausalLM, lora_config: LoraConfig) -> AutoModelForCausalLM:
        """Apply LoRA to model."""
        logger.info("Applying LoRA to model")
        model = get_peft_model(model, lora_config)
        model.print_trainable_parameters()
        return model
    
    def setup_training_arguments(self) -> TrainingArguments:
        """Setup training arguments."""
        training_config = self.config['training']

        # Coerce numeric fields to avoid type mismatches from YAML parsing
        def to_float(val, default=0.0):
            try:
                return float(val)
            except Exception:
                return default

        def to_int(val, default=0):
            try:
                return int(val)
            except Exception:
                return default

        learning_rate = to_float(training_config.get('learning_rate', 0.0))
        weight_decay = to_float(training_config.get('weight_decay', 0.0))
        warmup_ratio = to_float(training_config.get('warmup_ratio', 0.0))
        max_grad_norm = to_float(training_config.get('max_grad_norm', 0.0))
        logging_steps = to_int(training_config.get('logging_steps', 10))
        save_steps = to_int(training_config.get('save_steps', 500))
        save_total_limit = to_int(training_config.get('save_total_limit', 2))
        eval_steps = to_int(training_config.get('eval_steps', 500))
        num_train_epochs = to_float(training_config.get('num_train_epochs', 1))
        per_device_train_batch_size = to_int(training_config.get('per_device_train_batch_size', 1))
        per_device_eval_batch_size = to_int(training_config.get('per_device_eval_batch_size', 1))
        gradient_accumulation_steps = to_int(training_config.get('gradient_accumulation_steps', 1))
        
        eval_strategy = training_config.get('eval_strategy', training_config.get('evaluation_strategy', "no"))

        training_args = TrainingArguments(
            output_dir=training_config['output_dir'],
            num_train_epochs=num_train_epochs,
            per_device_train_batch_size=per_device_train_batch_size,
            per_device_eval_batch_size=per_device_eval_batch_size,
            gradient_accumulation_steps=gradient_accumulation_steps,
            learning_rate=learning_rate,
            weight_decay=weight_decay,
            lr_scheduler_type=training_config['lr_scheduler_type'],
            warmup_ratio=warmup_ratio,
            max_grad_norm=max_grad_norm,
            
            # Memory optimization
            gradient_checkpointing=training_config.get('gradient_checkpointing', False),
            dataloader_pin_memory=training_config.get('dataloader_pin_memory', False),
            fp16=training_config.get('fp16', False),
            bf16=training_config.get('bf16', True),
            
            # Logging and saving
            logging_steps=logging_steps,
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            eval_strategy=eval_strategy,
            eval_steps=eval_steps,
            load_best_model_at_end=training_config.get('load_best_model_at_end', True),
            metric_for_best_model=training_config.get('metric_for_best_model', "eval_loss"),
            
            # Advanced settings
            remove_unused_columns=training_config.get('remove_unused_columns', False),
            report_to=training_config.get('report_to', []),
            run_name=training_config.get('run_name', "qwen-training"),
            
            # Set seed
            seed=self.config['environment'].get('seed', 42),
            data_seed=self.config['environment'].get('seed', 42),
        )
        
        return training_args
    
    def setup_complete(self) -> tuple:
        """Complete model setup pipeline."""
        logger.info("Starting complete model setup")
        
        # Setup tokenizer
        tokenizer = self.setup_tokenizer()
        
        # Setup quantization
        quantization_config = self.setup_quantization_config()
        
        # Setup model
        model = self.setup_model(quantization_config)
        
        # Setup LoRA if enabled
        lora_config = self.setup_lora_config()
        if lora_config is not None:
            model = self.apply_lora(model, lora_config)
        
        # Setup training arguments
        training_args = self.setup_training_arguments()
        
        logger.info("Model setup complete")
        return model, tokenizer, training_args
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        if self.model is None:
            return {"error": "Model not loaded"}
        
        info = {
            "model_name": self.config['model']['name'],
            "quantization_enabled": self.config['quantization']['enabled'],
            "lora_enabled": self.config['lora']['enabled'],
            "trainable_params": 0,
            "total_params": 0
        }
        
        # Count parameters
        total_params = sum(p.numel() for p in self.model.parameters())
        trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        
        info.update({
            "total_params": total_params,
            "trainable_params": trainable_params,
            "trainable_percent": (trainable_params / total_params) * 100
        })
        
        return info


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from YAML file."""
    import yaml
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    return config


if __name__ == "__main__":
    # Example usage
    config = load_config("config/finetune_config.yaml")
    setup = ModelSetup(config)
    model, tokenizer, training_args = setup.setup_complete()
    
    # Print model info
    info = setup.get_model_info()
    print(f"Model: {info['model_name']}")
    print(f"Total parameters: {info['total_params']:,}")
    print(f"Trainable parameters: {info['trainable_params']:,}")
    print(f"Trainable percentage: {info['trainable_percent']:.2f}%")
