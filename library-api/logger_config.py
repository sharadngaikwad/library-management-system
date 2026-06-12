import logging
import sys

def setup_logger(name: str = "library-api") -> logging.Logger:
    logger = logging.getLogger(name)
    
    # If the logger is already configured, don't append duplicate handlers
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    # Scannable layout pattern: Timestamp | Level | Component | Message
    log_format = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Stream Handler for stdout (standard system console)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_format)
    logger.addHandler(console_handler)

    # Optional: File Handler for production server audits
    # file_handler = logging.FileHandler("library_api.log")
    # file_handler.setFormatter(log_format)
    # logger.addHandler(file_handler)

    return logger

# Shared core application logger reference
app_logger = setup_logger()