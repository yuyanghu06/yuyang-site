# Restore chin outline

The transparent embedded face canvas was excluded from outline selection but still wrote depth in front of the selected head, masking the chin edge. Its cloned runtime material now keeps depth testing but disables depth writing. The face artwork remains visible while the actual head mesh supplies the chin and jaw outline, without bringing back the rectangular canvas border.
