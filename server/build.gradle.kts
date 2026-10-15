plugins {
    java
    id("org.springframework.boot") version "3.4.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.iyae"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(22)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

// A dynamic version (`x.+`, `latest.release`) or a changing one (`-SNAPSHOT`) re-resolves on
// every build, so what ships can differ from what CI tested with no diff and nothing to review
// -- and the production image resolves a third time independently (server/Dockerfile runs its
// own `gradle bootJar`). This is the cheap half of the lockfile: it fails at the commit that
// introduces the range, instead of on the deploy that silently picked up a new release.
configurations.all {
    resolutionStrategy {
        failOnDynamicVersions()
        failOnChangingVersions()
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot starters
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Flyway
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-mysql")

    // MySQL
    runtimeOnly("com.mysql:mysql-connector-j")

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

    // Stripe. Pinned exactly, like every other version in this block.
    //
    // It was `26.+`, and a dynamic range does not exclude prereleases: at the time of pinning
    // the highest 26.x on Maven Central was 26.13.0-beta.1, so that is what every `gradle
    // bootJar` resolved -- the production image was being built against a *beta* of the one
    // library that verifies inbound webhook signatures and creates live Checkout sessions.
    // 26.12.0 is the newest stable 26.x. Bump it in a reviewed commit, not by rebuilding.
    implementation("com.stripe:stripe-java:26.12.0")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testRuntimeOnly("com.h2database:h2")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
