import re
from typing import Literal

from pydantic import field_validator

from slotera_api.schemas.operator_resources import StrictApiModel


class Branding(StrictApiModel):
    accent: str = "#3d5a3d"
    font_family: Literal["serif", "sans"] = "serif"

    @field_validator("accent")
    @classmethod
    def readable_colour(cls, value: str) -> str:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Use a six-digit hex colour")
        channels = [int(value[i : i + 2], 16) / 255 for i in (1, 3, 5)]
        luminance = sum(
            weight * (v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
            for weight, v in zip((0.2126, 0.7152, 0.0722), channels, strict=True)
        )
        if 1.05 / (luminance + 0.05) < 4.5:
            raise ValueError("Choose a darker colour so white button text stays readable")
        return value.lower()
