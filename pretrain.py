#!/usr/bin/env python3
"""
Pretraining script for Qwen 3.5-4B model.
Handles continued pretraining on large text datasets.
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
from transformers import Trainer, TrainingArguments, DataCollatorForLanguageModeling
from datasets import Dataset

# Import our modules
from model_setup import ModelSetup
from data_processing import prepare_pretraining_data

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PretrainingTrainer(Trainer):
    """Custom trainer for pretraining with enhanced monitoring."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.step_count = 0
    
    def compute_loss(self, model, inputs, return_outputs=False):
        """Compute loss for causal language modeling."""
        labels = inputs.get("labels")
        outputs = model(**inputs)
        
        # Save past state if it exists
        if self.args.past_index >= 0:
            self._past = outputs[self.args.past_index]
        
        # Extract loss
        loss = outputs.get("loss")
        
        # Log perplexity periodically
        if self.step_count % 100 == 0 and loss is not None:
            perplexity = torch.exp(loss).item()
            if wandb.run is not None:
                wandb.log({"perplexity": perplexity}, step=self.step_count)
        
        self.step_count += 1
        
        return (loss, outputs) if return_outputs else loss
    
    def log(self, logs):
        """Enhanced logging with pretraining-specific metrics."""
        logs = logs or {}
        
        # Add learning rate
        if self.lr_scheduler is not None:
            logs["learning_rate"] = self.lr_scheduler.get_last_lr()[0]
        
        # Add GPU memory usage
        if torch.cuda.is_available():
            logs["gpu_memory_allocated"] = torch.cuda.memory_allocated() / 1e9
            logs["gpu_memory_cached"] = torch.cuda.memory_reserved() / 1e9
        
        # Calculate and log perplexity from loss
        if "train_loss" in logs:
            logs["train_perplexity"] = torch.exp(torch.tensor(logs["train_loss"])).item()
        
        if "eval_loss" in logs:
            logs["eval_perplexity"] = torch.exp(torch.tensor(logs["eval_loss"])).item()
        
        super().log(logs)


def setup_wandb(config: dict):
    """Initialize Weights & Biases logging for pretraining."""
    if "wandb" in config['training'].get('report_to', []):
        wandb.init(
            project=config['environment']['wandb_project'],
            name=config['training']['run_name'],
            config=config,
            tags=["pretraining", "qwen"]
        )
        logger.info("Initialized Weights & Biases logging for pretraining")


def create_pretraining_data_collator(tokenizer):
    """Create data collator for pretraining."""
    return DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,  # We're doing causal LM, not masked LM
        pad_to_multiple_of=8 if tokenizer.pad_token_id is not None else None
    )


def evaluate_pretraining_progress(model, tokenizer, config: dict):
    """Evaluate pretraining progress with sample generation."""
    logger.info("Evaluating pretraining progress...")
    
    # Sample prompts to test generation
    test_prompts = [
        "The future of artificial intelligence",
        "In the year 2024,",
        "Machine learning is",
        "The benefits of technology include",
        "Climate change is"
    ]
    
    results = []
    
    model.eval()
    with torch.no_grad():
        for prompt in test_prompts:
            # Tokenize prompt
            inputs = tokenizer(prompt, return_tensors="pt")
            
            # Generate response
            generated = model.generate(
                **inputs,
                max_new_tokens=100,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
            
            # Decode generated text
            generated_text = tokenizer.decode(generated[0], skip_special_tokens=True)
            
            results.append({
                'prompt': prompt,
                'generated': generated_text
            })
    
    model.train()
    
    # Log samples to wandb if enabled
    if wandb.run is not None:
        table_data = []
        for result in results:
            table_data.append([
                result['prompt'],
                result['generated'][:300] + "..." if len(result['generated']) > 300 else result['generated']
            ])
        
        table = wandb.Table(
            columns=["Prompt", "Generated Text"],
            data=table_data
        )
        wandb.log({"generation_samples": table})
    
    logger.info(f"Generated samples for {len(test_prompts)} prompts")
    return results


def save_pretraining_checkpoint(model, tokenizer, output_dir: str, config: dict, step: int):
    """Save pretraining checkpoint."""
    checkpoint_dir = Path(output_dir) / f"checkpoint-{step}"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Saving pretraining checkpoint to {checkpoint_dir}")
    
    # Save model and tokenizer
    model.save_pretrained(checkpoint_dir)
    tokenizer.save_pretrained(checkpoint_dir)
    
    # Save config
    with open(checkpoint_dir / "pretraining_config.yaml", 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    
    logger.info("Pretraining checkpoint saved successfully")


class PretrainingCallback:
    """Custom callback for pretraining monitoring."""
    
    def __init__(self, config, model, tokenizer):
        self.config = config
        self.model = model
        self.tokenizer = tokenizer
        self.last_generation_step = 0
    
    def on_step_end(self, args, state, control, **kwargs):
        """Called at the end of each training step."""
        # Generate samples every 1000 steps
        if state.global_step % 1000 == 0 and state.global_step > self.last_generation_step:
            self.last_generation_step = state.global_step
            evaluate_pretraining_progress(self.model, self.tokenizer, self.config)


def main():
    parser = argparse.ArgumentParser(description="Pretrain Qwen 3.5-4B model")
    parser.add_argument("--config", type=str, required=True, help="Path to configuration file")
    parser.add_argument("--resume", type=str, help="Path to checkpoint to resume from")
    parser.add_argument("--output-dir", type=str, help="Override output directory")
    parser.add_argument("--wandb-disabled", action="store_true", help="Disable wandb logging")
    parser.add_argument("--streaming", action="store_true", help="Use streaming datasets")
    
    args = parser.parse_args()
    
    # Load configuration
    logger.info(f"Loading configuration from {args.config}")
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
    
    # Override settings if specified
    if args.output_dir:
        config['training']['output_dir'] = args.output_dir
    
    if args.streaming:
        config['data']['streaming'] = True
    
    # Disable wandb if requested
    if args.wandb_disabled:
        config['training']['report_to'] = [r for r in config['training'].get('report_to', []) if r != 'wandb']
    
    # Setup wandb
    setup_wandb(config)
    
    # Set random seed
    torch.manual_seed(config['environment']['seed'])
    
    try:
        # Setup model and tokenizer
        logger.info("Setting up model and tokenizer for pretraining...")
        setup = ModelSetup(config)
        model, tokenizer, training_args = setup.setup_complete()
        
        # Print model info
        model_info = setup.get_model_info()
        logger.info(f"Model: {model_info['model_name']}")
        logger.info(f"Total parameters: {model_info['total_params']:,}")
        logger.info(f"Trainable parameters: {model_info['trainable_params']:,}")
        logger.info(f"Trainable percentage: {model_info['trainable_percent']:.2f}%")
        
        # Prepare pretraining data
        logger.info("Preparing pretraining datasets...")
        train_dataset, eval_dataset = prepare_pretraining_data(config, tokenizer)
        
        logger.info(f"Train dataset prepared")
        if eval_dataset:
            logger.info(f"Validation dataset prepared")
        
        # Setup data collator for pretraining
        data_collator = create_pretraining_data_collator(tokenizer)
        
        # Setup callbacks
        callbacks = [PretrainingCallback(config, model, tokenizer)]
        
        # Setup trainer
        trainer = PretrainingTrainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            data_collator=data_collator,
            tokenizer=tokenizer,
            callbacks=callbacks
        )
        
        # Resume from checkpoint if specified
        resume_from_checkpoint = args.resume
        if resume_from_checkpoint and not os.path.exists(resume_from_checkpoint):
            logger.warning(f"Checkpoint path {resume_from_checkpoint} does not exist. Starting fresh training.")
            resume_from_checkpoint = None
        
        # Initial evaluation
        logger.info("Running initial generation test...")
        evaluate_pretraining_progress(model, tokenizer, config)
        
        # Start pretraining
        logger.info("Starting pretraining...")
        start_time = datetime.now()
        
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)
        
        end_time = datetime.now()
        training_time = end_time - start_time
        logger.info(f"Pretraining completed in {training_time}")
        
        # Final evaluation
        if eval_dataset:
            logger.info("Running final evaluation...")
            eval_results = trainer.evaluate()
            logger.info(f"Final evaluation results: {eval_results}")
        
        # Final generation test
        logger.info("Running final generation test...")
        final_samples = evaluate_pretraining_progress(model, tokenizer, config)
        
        # Save final model
        final_output_dir = os.path.join(config['training']['output_dir'], "final_pretrained_model")
        save_pretraining_checkpoint(model, tokenizer, final_output_dir, config, trainer.state.global_step)
        
        # Log final metrics
        if wandb.run is not None:
            wandb.log({
                "training_time_hours": training_time.total_seconds() / 3600,
                "final_eval_loss": eval_results.get("eval_loss", 0) if eval_dataset else 0,
                "final_perplexity": torch.exp(torch.tensor(eval_results.get("eval_loss", 0))).item() if eval_dataset else 0
            })
            wandb.finish()
        
        logger.info("Pretraining completed successfully!")
        
    except Exception as e:
        logger.error(f"Pretraining failed with error: {str(e)}")
        if wandb.run is not None:
            wandb.finish(exit_code=1)
        sys.exit(1)


if __name__ == "__main__":
    main()