abstract final class AppRoutes {
  static const primary = {
    '5271',
    '5638',
    '6416',
    '6922',
    '4',
    '4772',
    '1720',
    '4193',
  };
  static const public = {'7566', '7629', '7759', '7892'};
  static String path(String id) => switch (id) {
    '5271' => '/driver/home',
    '5638' => '/driver/trips',
    '6416' => '/driver/live',
    '6922' => '/driver/profile',
    '4' => '/assistant/home',
    '4772' => '/assistant/students',
    '1720' => '/assistant/stops',
    '4193' => '/assistant/duties',
    _ => '/screen/$id',
  };
}
