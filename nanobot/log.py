import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

from config import config


def setup_logging():
    """Menyiapkan logging console + file harian di folder workspace/logs."""

    log_dir = Path(config.workspace) / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    log_level = os.getenv("NANOBOT_LOG_LEVEL", "INFO").upper()

    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s"
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        log_dir / "nanobot.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    return root_logger
