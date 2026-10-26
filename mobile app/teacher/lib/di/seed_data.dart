import '../modules/attendance/repositories/attendance_seed.dart';
import '../modules/classes/repositories/classes_seed.dart';
import '../modules/engage/repositories/engage_seed.dart';
import '../modules/home/repositories/home_seed.dart';
import '../modules/lessons/repositories/lessons_seed.dart';
import '../modules/school/repositories/school_seed.dart';
import '../modules/tasks/repositories/tasks_seed.dart';
import '../utils/services/local_database_service.dart';

/// Initial on-device data for the local backend (every module owns its seed file).
Seed buildSeed() => {...schoolSeed, ...homeSeed, ...classesSeed, ...tasksSeed, ...attendanceSeed, ...lessonsSeed, ...engageSeed};
