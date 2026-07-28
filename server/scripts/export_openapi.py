"""Export Slotera's OpenAPI document for transport code generation."""

import json
import sys
from pathlib import Path

from slotera_api.main import app


def main() -> None:
    document = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
    if len(sys.argv) == 1:
        print(document, end="")
        return
    if len(sys.argv) != 2:
        raise SystemExit("usage: export_openapi.py [output-path]")
    output_path = Path(sys.argv[1])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(document, encoding="utf-8")


if __name__ == "__main__":
    main()
