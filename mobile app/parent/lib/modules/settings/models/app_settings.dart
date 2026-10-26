import 'package:equatable/equatable.dart';

/// App language choices of "6.2 Settings".
enum AppLanguage { english, hindi, marathi, tamil }

extension AppLanguageX on AppLanguage {
  String get label => switch (this) {
    AppLanguage.english => 'English (Default)',
    AppLanguage.hindi => 'Hindi',
    AppLanguage.marathi => 'Marathi',
    AppLanguage.tamil => 'Tamil',
  };
}

/// Guardian preferences (persisted on the device).
class AppSettings extends Equatable {
  const AppSettings({
    this.biometric = true,
    this.push = true,
    this.whatsapp = true,
    this.sms = true,
    this.digest = false,
    this.language = AppLanguage.english,
  });
  final bool biometric, push, whatsapp, sms, digest;
  final AppLanguage language;

  /// Enabled notification channels ("3 Active").
  int get activeChannels => [push, whatsapp, sms, digest].where((v) => v).length;

  AppSettings copyWith({
    bool? biometric,
    bool? push,
    bool? whatsapp,
    bool? sms,
    bool? digest,
    AppLanguage? language,
  }) => AppSettings(
    biometric: biometric ?? this.biometric,
    push: push ?? this.push,
    whatsapp: whatsapp ?? this.whatsapp,
    sms: sms ?? this.sms,
    digest: digest ?? this.digest,
    language: language ?? this.language,
  );

  @override
  List<Object?> get props => [biometric, push, whatsapp, sms, digest, language];
}
