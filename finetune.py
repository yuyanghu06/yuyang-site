#!/usr/bin/env python3
"""
Fine-tuning script for Qwen 3.5-4B model.
Complete training pipeline with LoRA, quantization, and evaluation.
"""

import os
import sys
import argparse
import logging
import torch
import wandb
from datetime import datetime
from pathlib import Path

import yaml
from transformers import Trainer, TrainingArguments, EarlyStoppingCallback
from datasets import Dataset

# Import our modules
from model_setup import ModelSetup
from data_processing import prepare_conversation_data, DataCollator

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class QwenTrainer(Trainer):
    """Custom trainer with additional logging and evaluation."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        """Compute loss with custom handling."""
        labels = inputs.get("labels")
        outputs = model(**inputs)
        
        # Save past state if it exists
        if getattr(self.args, "past_index", -1) >= 0:
            self._past = outputs[self.args.past_index]
        
        # Extract loss
        loss = outputs.get("loss")
        
        return (loss, outputs) if return_outputs else loss
    
    def log(self, logs):
        """Enhanced logging with additional metrics."""
        logs = logs or {}
        
        # Add learning rate to logs
        if self.lr_scheduler is not None:
            logs["learning_rate"] = self.lr_scheduler.get_last_lr()[0]
        
        # Add GPU memory usage
        if torch.cuda.is_available():
            logs["gpu_memory_allocated"] = torch.cuda.memory_allocated() / 1e9
            logs["gpu_memory_cached"] = torch.cuda.memory_reserved() / 1e9
        
        super().log(logs)


def setup_wandb(config: dict):
    """Initialize Weights & Biases logging."""
    if "wandb" in config['training'].get('report_to', []):
        wandb.init(
            project=config['environment']['wandb_project'],
            name=config['training']['run_name'],
            config=config
        )
        logger.info("Initialized Weights & Biases logging")


def evaluate_model(model, tokenizer, eval_dataset: Dataset, config: dict):
    """Run evaluation on the model."""
    logger.info("Running model evaluation...")
    
    # Sample a few examples for generation
    num_samples = min(5, len(eval_dataset))
    samples = eval_dataset.select(range(num_samples))
    
    results = []
    
    for i, sample in enumerate(samples):
        # Decode input to get the conversation
        input_text = tokenizer.decode(sample['input_ids'], skip_special_tokens=False)
        
        # Find the last assistant token to cut off the target
        assistant_token = "<|im_start|>assistant\n"
        if assistant_token in input_text:
            prompt = input_text.split(assistant_token)[0] + assistant_token
        else:
            # Fallback: use first half as prompt
            prompt = input_text[:len(input_text)//2]
        
        # Tokenize prompt
        prompt_tokens = tokenizer(prompt, return_tensors="pt")
        prompt_tokens = {k: v.to(model.device) for k, v in prompt_tokens.items()}
        
        # Generate response
        with torch.no_grad():
            generated = model.generate(
                **prompt_tokens,
                max_new_tokens=config['generation']['max_new_tokens'],
                do_sample=config['generation']['do_sample'],
                temperature=config['generation']['temperature'],
                top_p=config['generation']['top_p'],
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        # Decode generated response
        generated_text = tokenizer.decode(generated[0], skip_special_tokens=True)
        
        results.append({
            'sample': i,
            'prompt': prompt,
            'generated': generated_text,
            'original_input': input_text
        })
    
    # Log some samples to wandb if enabled
    if wandb.run is not None:
        table_data = []
        for result in results:
            table_data.append([
                result['sample'],
                result['prompt'][:200] + "..." if len(result['prompt']) > 200 else result['prompt'],
                result['generated'][:200] + "..." if len(result['generated']) > 200 else result['generated']
            ])
        
        table = wandb.Table(
            columns=["Sample", "Prompt", "Generated"],
            data=table_data
        )
        wandb.log({"evaluation_samples": table})
    
    logger.info(f"Evaluation completed on {len(results)} samples")
    return results


def save_model_and_tokenizer(model, tokenizer, output_dir: str, config: dict):
    """Save the trained model and tokenizer."""
    logger.info(f"Saving model to {output_dir}")
    
    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Save model and tokenizer
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    # Save config
    with open(Path(output_dir) / "training_config.yaml", 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    
    logger.info("Model, tokenizer, and config saved successfully")


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Qwen 3.5-4B model")
    parser.add_argument("--config", type=str, required=True, help="Path to configuration file")
    parser.add_argument("--resume", type=str, help="Path to checkpoint to resume from")
    parser.add_argument("--output-dir", type=str, help="Override output directory")
    parser.add_argument("--wandb-disabled", action="store_true", help="Disable wandb logging")
    
    args = parser.parse_args()
    
    # Load configuration
    logger.info(f"Loading configuration from {args.config}")
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
    
    # Override output dir if specified
    if args.output_dir:
        config['training']['output_dir'] = args.output_dir
    
    # Disable wandb if requested
    if args.wandb_disabled:
        config['training']['report_to'] = [r for r in config['training'].get('report_to', []) if r != 'wandb']
    
    # Setup wandb
    setup_wandb(config)
    
    # Set random seed
    torch.manual_seed(config['environment']['seed'])
    
    try:
        # Setup model and tokenizer
        logger.info("Setting up model and tokenizer...")
        setup = ModelSetup(config)
        model, tokenizer, training_args = setup.setup_complete()
        logger.info(f"Using device: {model.device}")
        
        # Print model info
        model_info = setup.get_model_info()
        logger.info(f"Model: {model_info['model_name']}")
        logger.info(f"Total parameters: {model_info['total_params']:,}")
        logger.info(f"Trainable parameters: {model_info['trainable_params']:,}")
        logger.info(f"Trainable percentage: {model_info['trainable_percent']:.2f}%")
        
        # Prepare data
        logger.info("Preparing datasets...")
        train_dataset, eval_dataset = prepare_conversation_data(config, tokenizer)
        
        logger.info(f"Train dataset: {len(train_dataset)} examples")
        if eval_dataset:
            logger.info(f"Validation dataset: {len(eval_dataset)} examples")
        
        # Setup data collator
        data_collator = DataCollator(tokenizer)
        
        # Setup trainer
        trainer_kwargs = {
            'model': model,
            'args': training_args,
            'train_dataset': train_dataset,
            'eval_dataset': eval_dataset,
            'data_collator': data_collator,
        }
        import inspect
        if "processing_class" in inspect.signature(Trainer.__init__).parameters:
            trainer_kwargs["processing_class"] = tokenizer
        else:
            trainer_kwargs["tokenizer"] = tokenizer
        
        # Add early stopping if configured
        callbacks = []
        if config['training'].get('early_stopping_patience'):
            callbacks.append(EarlyStoppingCallback(
                early_stopping_patience=config['training']['early_stopping_patience']
            ))
            trainer_kwargs['callbacks'] = callbacks
        
        trainer = QwenTrainer(**trainer_kwargs)
        
        # Resume from checkpoint if specified
        resume_from_checkpoint = args.resume
        if resume_from_checkpoint and not os.path.exists(resume_from_checkpoint):
            logger.warning(f"Checkpoint path {resume_from_checkpoint} does not exist. Starting fresh training.")
            resume_from_checkpoint = None
        
        # Start training
        logger.info("Starting training...")
        start_time = datetime.now()
        
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)
        
        end_time = datetime.now()
        training_time = end_time - start_time
        logger.info(f"Training completed in {training_time}")
        
        # Final evaluation
        if eval_dataset:
            logger.info("Running final evaluation...")
            eval_results = trainer.evaluate()
            logger.info(f"Final evaluation results: {eval_results}")
            
            # Generate some samples
            evaluation_samples = evaluate_model(model, tokenizer, eval_dataset, config)
        
        # Save final model
        final_output_dir = os.path.join(config['training']['output_dir'], "final_model")
        save_model_and_tokenizer(model, tokenizer, final_output_dir, config)
        
        # Log final metrics
        if wandb.run is not None:
            wandb.log({
                "training_time_minutes": training_time.total_seconds() / 60,
                "final_eval_loss": eval_results.get("eval_loss", 0) if eval_dataset else 0
            })
            wandb.finish()
        
        logger.info("Fine-tuning completed successfully!")
        
    except Exception as e:
        logger.error(f"Training failed with error: {str(e)}")
        if wandb.run is not None:
            wandb.finish(exit_code=1)
        sys.exit(1)


if __name__ == "__main__":
    main()
