"""One field-type validator for checkout, preparation and follow-up answers."""

from collections.abc import Mapping
from uuid import UUID

from slotera_api.db.models import FormTemplate


class FormValidationError(Exception):
    pass


def validate_form_responses(
    forms: list[FormTemplate], submissions: object
) -> list[tuple[FormTemplate, list[dict[str, object]]]]:
    if not isinstance(submissions, list):
        raise FormValidationError
    forms_by_id = {form.id: form for form in forms}
    submitted_by_id: dict[UUID, list[dict[str, object]]] = {}
    for submission in submissions:
        if not isinstance(submission, Mapping):
            raise FormValidationError
        form_id = submission.get("form_template_id")
        answers = submission.get("answers")
        if not isinstance(form_id, UUID) or form_id in submitted_by_id:
            raise FormValidationError
        form = forms_by_id.get(form_id)
        if form is None or not isinstance(answers, list):
            raise FormValidationError
        fields = {str(field["id"]): field for field in form.fields}
        normalized: list[dict[str, object]] = []
        seen: set[str] = set()
        for answer in answers:
            if not isinstance(answer, Mapping):
                raise FormValidationError
            field_id = str(answer.get("field_id", ""))
            if field_id in seen or field_id not in fields:
                raise FormValidationError
            seen.add(field_id)
            value = answer.get("value")
            field = fields[field_id]
            field_type = str(field.get("type"))
            options = field.get("options")
            options = options if isinstance(options, list) else []
            if field_type in {"yes_no", "consent_checkbox"}:
                if not isinstance(value, bool):
                    raise FormValidationError
                if field_type == "consent_checkbox" and field.get("required") and value is not True:
                    raise FormValidationError
            elif field_type == "multi_select":
                if (
                    not isinstance(value, list)
                    or len(value) > 100
                    or not all(isinstance(item, str) for item in value)
                    or len(set(value)) != len(value)
                    or not set(value) <= set(options or [])
                ):
                    raise FormValidationError
            else:
                if not isinstance(value, str) or len(value) > 4000:
                    raise FormValidationError
                if field_type == "single_select" and value not in (options or []) and value != "":
                    raise FormValidationError
                if field_type == "date" and value:
                    from datetime import date

                    try:
                        if date.fromisoformat(value).isoformat() != value:
                            raise ValueError
                    except ValueError as exc:
                        raise FormValidationError from exc
            normalized.append({"field_id": field_id, "value": value})
        for field_id, field in fields.items():
            if not field.get("required"):
                continue
            answer = next(
                (item["value"] for item in normalized if item["field_id"] == field_id),
                None,
            )
            if answer is None or (isinstance(answer, str) and not answer.strip()) or answer == []:
                raise FormValidationError
        submitted_by_id[form_id] = normalized
    if any(form.required_before_payment and form.id not in submitted_by_id for form in forms):
        raise FormValidationError
    return [(forms_by_id[form_id], answers) for form_id, answers in submitted_by_id.items()]
