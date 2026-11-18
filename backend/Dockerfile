# syntax=docker/dockerfile:1

# ---- Build stage: compile and package the Spring Boot jar ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

# Resolve dependencies first so they are cached independently of source changes.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src src
# Tests need Docker (Testcontainers), so they run outside the image build: ./mvnw verify
RUN ./mvnw -B -q package -DskipTests && cp target/scheduler-*.jar app.jar

# ---- Runtime stage: JRE only, non-root ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/app.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
