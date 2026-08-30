# Fix avatar-gap effect cleanup

- Changed the dynamic avatar-gap effect cleanup to return void explicitly.
- Prevented the CSSOM `removeProperty()` string result from violating React's effect destructor type.
- Targeted TypeScript and ESLint checks pass.
