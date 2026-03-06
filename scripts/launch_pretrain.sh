#!/bin/bash
# Launch pretraining with default configuration

# Set default values
CONFIG_FILE="config/pretrain_config.yaml"
OUTPUT_DIR="results/pretrain_$(date +%Y%m%d_%H%M%S)"
WANDB_ENABLED=true
STREAMING=false

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
        --streaming)
            STREAMING=true
            shift
            ;;
        --resume)
            RESUME_FROM="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --config FILE       Configuration file (default: config/pretrain_config.yaml)"
            echo "  --output-dir DIR    Output directory (default: results/pretrain_TIMESTAMP)"
            echo "  --no-wandb          Disable wandb logging"
            echo "  --streaming         Use streaming datasets"
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

echo "Starting Qwen pretraining..."
echo "Config: $CONFIG_FILE"
echo "Output: $OUTPUT_DIR"

# Build command
CMD="python pretrain.py --config $CONFIG_FILE --output-dir $OUTPUT_DIR"

if [ "$WANDB_ENABLED" = false ]; then
    CMD="$CMD --wandb-disabled"
fi

if [ "$STREAMING" = true ]; then
    CMD="$CMD --streaming"
fi

if [ ! -z "$RESUME_FROM" ]; then
    CMD="$CMD --resume $RESUME_FROM"
fi

# Run the command
eval $CMD