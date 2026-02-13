from typing import Dict, Any, List, Optional
import json
from deepdiff import DeepDiff
from pydantic import BaseModel


class SchemaDriftReport(BaseModel):
    drift_type: str  # 'breaking', 'non-breaking', 'semantic'
    changes: Dict[str, Any]
    severity: str  # 'low', 'medium', 'high', 'critical'
    is_backward_compatible: bool


class SchemaDriftDetector:
    """
    Detects changes between two versions of an API specification.
    """

    def detect_drift(
        self, old_spec: Dict[str, Any], new_spec: Dict[str, Any]
    ) -> SchemaDriftReport:
        """
        Compare old and new OpenAPI specs to detect drift.
        """
        diff = DeepDiff(old_spec, new_spec, ignore_order=True)

        if not diff:
            return SchemaDriftReport(
                drift_type="none",
                changes={},
                severity="low",
                is_backward_compatible=True,
            )

        # Analyze diff to determine severity

        severity = "low"
        drift_type = "non-breaking"
        is_compatible = True

        # 1. Removal of items (Potential Breaking)
        if "dictionary_item_removed" in diff:
            removed_paths = diff["dictionary_item_removed"]
            for path in removed_paths:
                # Removing an endpoint is breaking
                if "paths" in path:
                    severity = "critical"
                    drift_type = "breaking"
                    is_compatible = False
                    break
                # Removing a property from a schema might be breaking if client relies on it
                if "properties" in path:
                    severity = "high"
                    drift_type = "breaking"
                    is_compatible = False

        # 2. Type changes (Breaking)
        if "type_changes" in diff:
            severity = "high"
            drift_type = "breaking"
            is_compatible = False

        # 3. Value changes (Check for required/nullable changes)
        if "values_changed" in diff:
            for path, change in diff["values_changed"].items():
                # Making a parameter required is breaking
                if "required" in path and change["new_value"] is True:
                    severity = "high"
                    drift_type = "breaking"
                    is_compatible = False

        return SchemaDriftReport(
            drift_type=drift_type,
            changes=json.loads(diff.to_json()),
            severity=severity,
            is_backward_compatible=is_compatible,
        )
