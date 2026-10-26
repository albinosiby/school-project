class TextHelper {
  TextHelper._();

  static String capitalize(String text) {
    if (text.isEmpty) return text;
    return text[0].toUpperCase() + text.substring(1);
  }

  static String capitalizeEachWord(String text) {
    if (text.isEmpty) return text;
    return text.split(' ').map((word) => capitalize(word)).join(' ');
  }

  static String truncate(String text, int maxLength,
      {String suffix = '...'}) {
    if (text.length <= maxLength) return text;
    return '${text.substring(0, maxLength)}$suffix';
  }

  static String removeHtmlTags(String htmlText) {
    return htmlText.replaceAll(RegExp(r'<[^>]*>'), '');
  }
}
