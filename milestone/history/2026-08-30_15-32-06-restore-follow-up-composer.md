# Restore the follow-up composer

The intro Yes/No phase remains active when a visitor replies instead of choosing a tour option. Its special inline-composer suppression was therefore also hiding the normal textbox on later agent answers.

That suppression now applies only while the original choice row is active with no presentation action. Replying to the resulting agent answer correctly replaces its controls with the inline form. Targeted ESLint, TypeScript, and diff validation pass.
