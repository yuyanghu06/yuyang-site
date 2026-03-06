#!/usr/bin/env python3
"""
Data loading and preprocessing pipeline for Qwen training.
Handles conversation datasets and text preprocessing.
"""

import json
import torch
from datasets import Dataset, load_dataset
from transformers import AutoTokenizer
from torch.utils.data import DataLoader
from typing import Dict, List, Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConversationDataProcessor:
    """Process conversation datasets for Qwen training."""
    
    def __init__(self, tokenizer: AutoTokenizer, max_seq_length: int = 2048):
        self.tokenizer = tokenizer
        self.max_seq_length = max_seq_length
        
    def format_conversation(self, messages: List[Dict[str, str]]) -> str:
        """Format conversation messages using tokenizer's chat template."""
        try:
            formatted = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False
            )
            return formatted
        except Exception as e:
            logger.warning(f"Error formatting conversation: {e}")
            # Fallback formatting
            formatted = ""
            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                formatted += f"<|im_start|>{role}\n{content}<|im_end|>\n"
            return formatted
    
    def tokenize_conversation(self, example: Dict[str, Any]) -> Dict[str, List[int]]:
        """Tokenize a single conversation example."""
        messages = example.get("messages", [])
        
        # Format the conversation
        formatted_text = self.format_conversation(messages)
        
        # Tokenize
        tokenized = self.tokenizer(
            formatted_text,
            truncation=True,
            max_length=self.max_seq_length,
            padding=False,
            return_tensors=None
        )
        
        # For causal LM, input_ids and labels are the same
        tokenized["labels"] = tokenized["input_ids"].copy()
        
        return tokenized
    
    def prepare_dataset(self, dataset_path: str, split_ratio: float = 0.1) -> tuple:
        """Load and prepare dataset for training."""
        logger.info(f"Loading dataset from {dataset_path}")
        
        # Load dataset
        if dataset_path.endswith('.jsonl'):
            data = []
            with open(dataset_path, 'r', encoding='utf-8') as f:
                for line in f:
                    data.append(json.loads(line.strip()))
            dataset = Dataset.from_list(data)
        elif dataset_path.endswith('.json'):
            with open(dataset_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict):
                data = [data]
            dataset = Dataset.from_list(data)
        else:
            # Try to load as HuggingFace dataset
            dataset = load_dataset(dataset_path, split='train')
        
        logger.info(f"Loaded {len(dataset)} examples")
        
        # Tokenize dataset
        logger.info("Tokenizing dataset...")
        tokenized_dataset = dataset.map(
            self.tokenize_conversation,
            remove_columns=dataset.column_names,
            desc="Tokenizing conversations"
        )
        
        # Split into train/validation if needed
        if split_ratio > 0:
            split_dataset = tokenized_dataset.train_test_split(test_size=split_ratio, seed=42)
            train_dataset = split_dataset['train']
            eval_dataset = split_dataset['test']
        else:
            train_dataset = tokenized_dataset
            eval_dataset = None
        
        logger.info(f"Train dataset: {len(train_dataset)} examples")
        if eval_dataset:
            logger.info(f"Validation dataset: {len(eval_dataset)} examples")
        
        return train_dataset, eval_dataset


class PretrainingDataProcessor:
    """Process text datasets for pretraining."""
    
    def __init__(self, tokenizer: AutoTokenizer, block_size: int = 2048):
        self.tokenizer = tokenizer
        self.block_size = block_size
    
    def tokenize_function(self, examples: Dict[str, List[str]]) -> Dict[str, List[List[int]]]:
        """Tokenize text examples."""
        texts = examples.get("text", [])
        
        # Tokenize all texts
        tokenized = self.tokenizer(
            texts,
            truncation=False,
            padding=False,
            return_tensors=None
        )
        
        return tokenized
    
    def group_texts(self, examples: Dict[str, List[List[int]]]) -> Dict[str, List[List[int]]]:
        """Group tokenized texts into blocks of specified size."""
        # Concatenate all texts
        concatenated = {k: sum(examples[k], []) for k in examples.keys()}
        total_length = len(concatenated[list(examples.keys())[0]])
        
        # Split into blocks
        if total_length >= self.block_size:
            total_length = (total_length // self.block_size) * self.block_size
        
        result = {
            k: [t[i:i + self.block_size] for i in range(0, total_length, self.block_size)]
            for k, t in concatenated.items()
        }
        
        # For causal LM, labels are the same as input_ids
        if "input_ids" in result:
            result["labels"] = result["input_ids"].copy()
        
        return result
    
    def prepare_pretraining_dataset(self, dataset_path: str, streaming: bool = False) -> Dataset:
        """Prepare dataset for pretraining."""
        logger.info(f"Loading pretraining dataset from {dataset_path}")
        
        # Load dataset
        if streaming:
            dataset = load_dataset(dataset_path, streaming=True, split='train')
        else:
            if dataset_path.endswith('.jsonl'):
                data = []
                with open(dataset_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        item = json.loads(line.strip())
                        # Assume text field contains the raw text
                        if 'text' in item:
                            data.append(item)
                        else:
                            # If no text field, assume the whole item is text
                            data.append({'text': str(item)})
                dataset = Dataset.from_list(data)
            else:
                dataset = load_dataset(dataset_path, split='train')
        
        logger.info("Tokenizing dataset...")
        
        # Tokenize
        tokenized_dataset = dataset.map(
            self.tokenize_function,
            batched=True,
            remove_columns=dataset.column_names if not streaming else None,
            desc="Tokenizing texts"
        )
        
        # Group into blocks
        logger.info("Grouping texts into blocks...")
        grouped_dataset = tokenized_dataset.map(
            self.group_texts,
            batched=True,
            desc="Grouping texts"
        )
        
        return grouped_dataset


class DataCollator:
    """Custom data collator for conversation training."""
    
    def __init__(self, tokenizer: AutoTokenizer, mlm: bool = False):
        self.tokenizer = tokenizer
        self.mlm = mlm
    
    def __call__(self, features: List[Dict[str, Any]]) -> Dict[str, torch.Tensor]:
        """Collate batch of features."""
        # Extract input_ids and labels
        input_ids = [f["input_ids"] for f in features]
        labels = [f["labels"] for f in features]
        
        # Pad sequences
        batch = self.tokenizer.pad(
            {"input_ids": input_ids},
            padding=True,
            return_tensors="pt"
        )
        
        # Pad labels
        max_length = batch["input_ids"].shape[1]
        padded_labels = []
        
        for label in labels:
            padded_label = label + [-100] * (max_length - len(label))
            padded_labels.append(padded_label)
        
        batch["labels"] = torch.tensor(padded_labels)
        
        return batch


def create_data_loaders(config: Dict[str, Any], tokenizer: AutoTokenizer, 
                       train_dataset: Dataset, eval_dataset: Optional[Dataset] = None):
    """Create data loaders for training."""
    data_collator = DataCollator(tokenizer)
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=config['training']['per_device_train_batch_size'],
        shuffle=True,
        collate_fn=data_collator,
        num_workers=config['data'].get('preprocessing_num_workers', 0),
        pin_memory=config['training'].get('dataloader_pin_memory', False)
    )
    
    eval_loader = None
    if eval_dataset is not None:
        eval_loader = DataLoader(
            eval_dataset,
            batch_size=config['training']['per_device_eval_batch_size'],
            shuffle=False,
            collate_fn=data_collator,
            num_workers=config['data'].get('preprocessing_num_workers', 0),
            pin_memory=config['training'].get('dataloader_pin_memory', False)
        )
    
    return train_loader, eval_loader


def prepare_conversation_data(config: Dict[str, Any], tokenizer: AutoTokenizer):
    """Prepare conversation data for fine-tuning."""
    processor = ConversationDataProcessor(
        tokenizer=tokenizer,
        max_seq_length=config['data']['max_seq_length']
    )
    
    train_file = config['data']['train_file']
    validation_file = config['data'].get('validation_file')
    
    if validation_file and validation_file != train_file:
        # Load separate validation file
        train_dataset, _ = processor.prepare_dataset(train_file, split_ratio=0)
        eval_dataset, _ = processor.prepare_dataset(validation_file, split_ratio=0)
    else:
        # Split training data
        train_dataset, eval_dataset = processor.prepare_dataset(train_file, split_ratio=0.1)
    
    return train_dataset, eval_dataset


def prepare_pretraining_data(config: Dict[str, Any], tokenizer: AutoTokenizer):
    """Prepare data for pretraining."""
    processor = PretrainingDataProcessor(
        tokenizer=tokenizer,
        block_size=config['data'].get('block_size', 2048)
    )
    
    train_file = config['data']['train_file']
    streaming = config['data'].get('streaming', False)
    
    train_dataset = processor.prepare_pretraining_dataset(train_file, streaming=streaming)
    
    # For pretraining, we might want a separate validation set
    validation_file = config['data'].get('validation_file')
    eval_dataset = None
    if validation_file:
        eval_dataset = processor.prepare_pretraining_dataset(validation_file, streaming=False)
    
    return train_dataset, eval_dataset


if __name__ == "__main__":
    # Example usage
    from model_setup import load_config, ModelSetup
    
    config = load_config("config/finetune_config.yaml")
    setup = ModelSetup(config)
    tokenizer = setup.setup_tokenizer()
    
    # Prepare data
    train_dataset, eval_dataset = prepare_conversation_data(config, tokenizer)
    
    print(f"Train dataset: {len(train_dataset)} examples")
    if eval_dataset:
        print(f"Validation dataset: {len(eval_dataset)} examples")
    
    # Show a sample
    if len(train_dataset) > 0:
        sample = train_dataset[0]
        print(f"Sample input length: {len(sample['input_ids'])}")
        decoded = tokenizer.decode(sample['input_ids'], skip_special_tokens=False)
        print(f"Sample text preview: {decoded[:200]}...")