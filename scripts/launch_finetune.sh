#!/bin/bash
# Launch fine-tuning with default configuration

# Set default values
CONFIG_FILE="config/finetune_config.yaml"
OUTPUT_DIR="results/finetune_$(date +%Y%m%d_%H%M%S)"
WANDB_ENABLED=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --no-wandb)
            WANDB_ENABLED=false
            shift
            ;;
        --resume)
            RESUME_FROM="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --config FILE       Configuration file (default: config/finetune_config.yaml)"
            echo "  --output-dir DIR    Output directory (default: results/finetune_TIMESTAMP)"
            echo "  --no-wandb          Disable wandb logging"
            echo "  --resume CHECKPOINT Resume from checkpoint"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

echo "Starting Qwen fine-tuning..."
echo "Config: $CONFIG_FILE"
echo "Output: $OUTPUT_DIR"

# Build command
CMD="python finetune.py --config $CONFIG_FILE --output-dir $OUTPUT_DIR"

if [ "$WANDB_ENABLED" = false ]; then
    CMD="$CMD --wandb-disabled"
fi

if [ ! -z "$RESUME_FROM" ]; then
    CMD="$CMD --resume $RESUME_FROM"
fi

# Run the command
eval $CMD