allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

// Older plugins (file_picker 8.x) still declare compileSdk 34; AGP 9 refuses to link them against the lifecycle
// library built for API 36. Lift every library module to the app's compile SDK.
subprojects {
    if (name == "app") return@subprojects
    fun liftCompileSdk() {
        val android = extensions.findByName("android") ?: return
        val setter = android.javaClass.methods.firstOrNull { it.name == "setCompileSdk" && it.parameterTypes.size == 1 }
        setter?.invoke(android, 36)
    }
    if (state.executed) liftCompileSdk() else afterEvaluate { liftCompileSdk() }
}
