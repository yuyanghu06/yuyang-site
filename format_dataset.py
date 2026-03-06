#!/usr/bin/env python3
"""
Dataset Formatter for Qwen Fine-tuning
Converts various text dataset formats into user-assistant conversation pairs.
"""

import json
import pandas as pd
import argparse
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatasetFormatter:
    """Handles conversion of datasets to conversation format for Qwen training."""
    
    def __init__(self, system_prompt: Optional[str] = None):
        self.system_prompt = system_prompt or "You are a helpful AI assistant."
    
    def format_conversation(self, user_message: str, assistant_message: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Format a single conversation pair."""
        messages = []
        
        if system_prompt or self.system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt or self.system_prompt
            })
        
        messages.extend([
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_message}
        ])
        
        return {"messages": messages}
    
    def process_instruction_dataset(self, data: List[Dict[str, Any]], 
                                  instruction_key: str = "instruction",
                                  input_key: str = "input", 
                                  output_key: str = "output") -> List[Dict[str, Any]]:
        """Process instruction-following datasets (like Alpaca format)."""
        formatted_data = []
        
        for item in data:
            instruction = item.get(instruction_key, "")
            input_text = item.get(input_key, "")
            output = item.get(output_key, "")
            
            # Combine instruction and input
            if input_text:
                user_message = f"{instruction}\n\n{input_text}"
            else:
                user_message = instruction
            
            if user_message and output:
                formatted_data.append(
                    self.format_conversation(user_message, output)
                )
        
        return formatted_data
    
    def process_qa_dataset(self, data: List[Dict[str, Any]], 
                          question_key: str = "question",
                          answer_key: str = "answer") -> List[Dict[str, Any]]:
        """Process Q&A datasets."""
        formatted_data = []
        
        for item in data:
            question = item.get(question_key, "")
            answer = item.get(answer_key, "")
            
            if question and answer:
                formatted_data.append(
                    self.format_conversation(question, answer)
                )
        
        return formatted_data
    
    def process_conversation_dataset(self, data: List[Dict[str, Any]],
                                   conversation_key: str = "conversation") -> List[Dict[str, Any]]:
        """Process datasets that are already in conversation format."""
        formatted_data = []
        
        for item in data:
            conversation = item.get(conversation_key, [])
            
            if isinstance(conversation, list) and len(conversation) >= 2:
                # Group messages into user-assistant pairs
                messages = []
                current_messages = []
                
                for msg in conversation:
                    if msg.get("role") == "system":
                        current_messages.append(msg)
                    elif msg.get("role") == "user":
                        if current_messages and current_messages[-1].get("role") == "assistant":
                            # Save previous conversation
                            if len(current_messages) >= 2:
                                formatted_data.append({"messages": current_messages.copy()})
                            current_messages = []
                        current_messages.append(msg)
                    elif msg.get("role") == "assistant":
                        current_messages.append(msg)
                        # Complete conversation pair
                        if len(current_messages) >= 2:
                            formatted_data.append({"messages": current_messages.copy()})
                            current_messages = []
        
        return formatted_data
    
    def process_text_pairs(self, data: List[Dict[str, Any]],
                          input_key: str = "input",
                          target_key: str = "target") -> List[Dict[str, Any]]:
        """Process simple input-target text pairs."""
        formatted_data = []
        
        for item in data:
            input_text = item.get(input_key, "")
            target_text = item.get(target_key, "")
            
            if input_text and target_text:
                formatted_data.append(
                    self.format_conversation(input_text, target_text)
                )
        
        return formatted_data
    
    def load_dataset(self, file_path: str) -> List[Dict[str, Any]]:
        """Load dataset from various file formats."""
        path = Path(file_path)
        
        if path.suffix == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        elif path.suffix == '.jsonl':
            data = []
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    data.append(json.loads(line.strip()))
        elif path.suffix == '.csv':
            df = pd.read_csv(path)
            data = df.to_dict('records')
        elif path.suffix in ['.tsv', '.txt']:
            df = pd.read_csv(path, sep='\t')
            data = df.to_dict('records')
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")
        
        return data if isinstance(data, list) else [data]
    
    def save_dataset(self, data: List[Dict[str, Any]], output_path: str):
        """Save formatted dataset."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if path.suffix == '.json':
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        elif path.suffix == '.jsonl':
            with open(path, 'w', encoding='utf-8') as f:
                for item in data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
        else:
            raise ValueError(f"Unsupported output format: {path.suffix}")


def main():
    parser = argparse.ArgumentParser(description="Format datasets for Qwen fine-tuning")
    parser.add_argument("input_file", help="Input dataset file")
    parser.add_argument("output_file", help="Output formatted dataset file")
    parser.add_argument("--format", choices=["instruction", "qa", "conversation", "text_pairs"], 
                       default="instruction", help="Dataset format type")
    parser.add_argument("--system-prompt", help="Custom system prompt")
    parser.add_argument("--instruction-key", default="instruction", help="Key for instruction field")
    parser.add_argument("--input-key", default="input", help="Key for input field")
    parser.add_argument("--output-key", default="output", help="Key for output field")
    parser.add_argument("--question-key", default="question", help="Key for question field")
    parser.add_argument("--answer-key", default="answer", help="Key for answer field")
    parser.add_argument("--conversation-key", default="conversation", help="Key for conversation field")
    
    args = parser.parse_args()
    
    # Initialize formatter
    formatter = DatasetFormatter(system_prompt=args.system_prompt)
    
    # Load dataset
    logger.info(f"Loading dataset from {args.input_file}")
    data = formatter.load_dataset(args.input_file)
    logger.info(f"Loaded {len(data)} samples")
    
    # Process based on format
    if args.format == "instruction":
        formatted_data = formatter.process_instruction_dataset(
            data, args.instruction_key, args.input_key, args.output_key
        )
    elif args.format == "qa":
        formatted_data = formatter.process_qa_dataset(
            data, args.question_key, args.answer_key
        )
    elif args.format == "conversation":
        formatted_data = formatter.process_conversation_dataset(
            data, args.conversation_key
        )
    elif args.format == "text_pairs":
        formatted_data = formatter.process_text_pairs(
            data, args.input_key, args.output_key
        )
    else:
        raise ValueError(f"Unknown format: {args.format}")
    
    # Save formatted dataset
    logger.info(f"Formatted {len(formatted_data)} conversations")
    formatter.save_dataset(formatted_data, args.output_file)
    logger.info(f"Saved formatted dataset to {args.output_file}")
    
    # Print sample
    if formatted_data:
        logger.info("Sample conversation:")
        print(json.dumps(formatted_data[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()