FROM gradle:8.10-jdk22 AS build
WORKDIR /app
COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
COPY src ./src
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:22-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar

# Run as an unprivileged user, matching what web/Dockerfile already does. This image ran as
# root, so any code execution in the API — the designer image upload and GLB parsing paths
# being the live examples — was root inside the container, with write access to the shared
# assets volume that holds every upload and every generated model.
#
# The uid is pinned to 10001 and MUST stay equal to the one in worker/Dockerfile and
# worker/Dockerfile.rigging: all three mount `assets_data` read-write, so a mismatch means one
# service cannot write, or overwrite, what another created.
#
# Creating /var/iyae/assets here is what gives the named volume its ownership. Docker seeds a
# NEW, EMPTY named volume from the image's contents at that path, ownership included — so a
# first deployment gets a 10001-owned volume with no extra step. A volume that already exists
# from a root-era deployment keeps root ownership and must be claimed once; `dev.sh start` and
# `prod_deploy.sh up` do that automatically (claim_asset_volume).
RUN groupadd --gid 10001 iyae \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin iyae \
    && mkdir -p /var/iyae/assets \
    && chown -R 10001:10001 /var/iyae/assets

USER 10001:10001

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
