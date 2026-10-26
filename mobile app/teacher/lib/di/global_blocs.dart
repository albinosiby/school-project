import 'package:flutter_bloc/flutter_bloc.dart';
import '../modules/auth/bloc/auth_bloc.dart';
import '../modules/home/bloc/notifications_bloc.dart';
import '../modules/home/bloc/notifications_events.dart';
import '../modules/school/bloc/school_bloc.dart';
import '../modules/school/bloc/school_events.dart';
import 'injection.dart';

/// BLoCs that live for the whole app (read from many screens). Screen-level
/// BLoCs are created with BlocProvider inside their screens.
List<BlocProvider> globalBlocProviders() => [
      BlocProvider<AuthBloc>.value(value: getIt<AuthBloc>()),
      BlocProvider<SchoolBloc>(create: (_) => getIt<SchoolBloc>()..add(const SchoolLoadRequested())),
      BlocProvider<NotificationsBloc>(create: (_) => getIt<NotificationsBloc>()..add(const NotificationsLoadRequested())),
    ];
