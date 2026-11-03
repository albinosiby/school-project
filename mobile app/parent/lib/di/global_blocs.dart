import 'package:flutter_bloc/flutter_bloc.dart';
import '../modules/auth/bloc/auth_bloc.dart';
import '../modules/consent/bloc/consent_bloc.dart';
import '../modules/family/bloc/family_bloc.dart';
import '../modules/notifications/bloc/notifications_bloc.dart';
import 'injection.dart';

/// App-wide BLoCs (provided above the router).
List<BlocProvider> globalBlocProviders() => [
  BlocProvider<AuthBloc>.value(value: getIt<AuthBloc>()),
  BlocProvider<FamilyBloc>.value(value: getIt<FamilyBloc>()),
  BlocProvider<NotificationsBloc>.value(value: getIt<NotificationsBloc>()),
  BlocProvider<ConsentBloc>.value(value: getIt<ConsentBloc>()),
];
