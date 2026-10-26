mixin ValidationMixin {
  String? validateRequired(String? v, [String field = 'This field']) =>
      (v == null || v.trim().isEmpty) ? '$field is required' : null;

  String? validateEmail(String? v) {
    if (v == null || v.trim().isEmpty) return 'Email is required';
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())
        ? null
        : 'Enter a valid email address';
  }
}
