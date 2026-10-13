package com.iyae.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Covers which configurations the validator refuses to boot on, and — the part that had no test
 * and no mechanism — what it does when the profile itself is wrong.
 *
 * <p>It was annotated {@code @Profile("prod")}, so every check inside it depended on
 * {@code SPRING_PROFILES_ACTIVE} being spelled exactly {@code prod}. A deploy that forgot the
 * variable, or set {@code production}, skipped the whole class silently — the same profile-name
 * fragility this codebase already hit in {@code DataSeeder}, in the opposite direction. The bean
 * now always loads and decides from the active profiles.
 */
class ProductionConfigValidatorTest {

    /** A configuration that satisfies every check, so each test can break exactly one thing. */
    private ProductionConfigValidator validatorFor(String... activeProfiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(activeProfiles);
        ProductionConfigValidator validator = new ProductionConfigValidator(environment);
        set(validator, "corsOrigins", "https://iyae.ca");
        set(validator, "frontendBaseUrl", "https://iyae.ca");
        set(validator, "internalMailSecret", "a-real-generated-secret");
        set(validator, "resendMailEndpoint", "http://web:3000/api/internal/mail/send");
        set(validator, "stripeSecretKey", "");
        set(validator, "stripeWebhookSecret", "");
        return validator;
    }

    private static void set(ProductionConfigValidator validator, String field, Object value) {
        ReflectionTestUtils.setField(validator, field, value);
    }

    private static void validate(ProductionConfigValidator validator) {
        ReflectionTestUtils.invokeMethod(validator, "validate");
    }

    @Test
    @DisplayName("a complete prod configuration boots")
    void completeProdConfigPasses() {
        assertThatCode(() -> validate(validatorFor("prod"))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("payment off — neither Stripe value set — is a valid prod configuration")
    void paymentOffIsValid() {
        // Launch #1 ships without payment on purpose. That is a 503 at the endpoint, not a boot
        // failure, which is the distinction this whole class is built around.
        assertThatCode(() -> validate(validatorFor("prod"))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("a Stripe key with no webhook secret refuses to boot")
    void halfConfiguredStripeRefusesToBoot() {
        // prod_deploy.sh validates this pair too, but an operator who brings the stack up with
        // plain `docker compose` never runs that script. Half-configured is the dangerous state:
        // CheckoutService treats it as payment-off, so a deployment that believes it has enabled
        // payment would quietly sell nothing.
        ProductionConfigValidator validator = validatorFor("prod");
        set(validator, "stripeSecretKey", "sk_live_abc");

        assertThatThrownBy(() -> validate(validator))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Refusing to start");
    }

    @Test
    @DisplayName("a webhook secret with no key refuses to boot")
    void webhookSecretWithoutKeyRefusesToBoot() {
        ProductionConfigValidator validator = validatorFor("prod");
        set(validator, "stripeWebhookSecret", "whsec_abc");

        assertThatThrownBy(() -> validate(validator))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Refusing to start");
    }

    @Test
    @DisplayName("both Stripe values set is a valid prod configuration")
    void fullyConfiguredStripeBoots() {
        ProductionConfigValidator validator = validatorFor("prod");
        set(validator, "stripeSecretKey", "sk_live_abc");
        set(validator, "stripeWebhookSecret", "whsec_abc");

        assertThatCode(() -> validate(validator)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("a localhost FRONTEND_BASE_URL refuses to boot")
    void localhostFrontendUrlRefusesToBoot() {
        ProductionConfigValidator validator = validatorFor("prod");
        set(validator, "frontendBaseUrl", "http://localhost:3000");

        assertThatThrownBy(() -> validate(validator)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("the published dev mail secret refuses to boot")
    void devMailSecretRefusesToBoot() {
        ProductionConfigValidator validator = validatorFor("prod");
        set(validator, "internalMailSecret", "dev-internal-secret");

        assertThatThrownBy(() -> validate(validator)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("an empty CORS_ORIGINS refuses to boot")
    void emptyCorsOriginsRefusesToBoot() {
        ProductionConfigValidator validator = validatorFor("prod");
        set(validator, "corsOrigins", "");

        assertThatThrownBy(() -> validate(validator)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("under dev the checks are skipped without complaint")
    void devProfileSkipsSilently() {
        // dev legitimately runs on localhost with the published mail secret. Validating there
        // would make the normal development setup unbootable.
        ProductionConfigValidator validator = validatorFor("dev");
        set(validator, "frontendBaseUrl", "http://localhost:3000");
        set(validator, "internalMailSecret", "dev-internal-secret");
        set(validator, "corsOrigins", "");

        assertThatCode(() -> validate(validator)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("under test the checks are skipped without complaint")
    void testProfileSkipsSilently() {
        ProductionConfigValidator validator = validatorFor("test");
        set(validator, "corsOrigins", "");

        assertThatCode(() -> validate(validator)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("an unrecognised profile skips the checks without throwing — but is not silent")
    void unrecognisedProfileSkipsLoudly() {
        // The case the @Profile("prod") annotation could not express. `production`, or no
        // variable at all, must not fail startup — that would break anyone running a profile of
        // their own — but it must not look like a validated deployment either. The ERROR line is
        // the mechanism; what is asserted here is that this is reached at all rather than the
        // bean never being constructed.
        ProductionConfigValidator validator = validatorFor("production");
        set(validator, "corsOrigins", "");

        assertThatCode(() -> validate(validator)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("no active profile at all skips the checks without throwing")
    void noActiveProfileSkips() {
        ProductionConfigValidator validator = validatorFor();
        set(validator, "corsOrigins", "");

        assertThatCode(() -> validate(validator)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("prod alongside another profile still validates")
    void prodAmongSeveralProfilesStillValidates() {
        // `SPRING_PROFILES_ACTIVE=prod,metrics` is an ordinary thing to write, and the checks
        // have to survive it.
        ProductionConfigValidator validator = validatorFor("prod", "metrics");
        set(validator, "corsOrigins", "");

        assertThatThrownBy(() -> validate(validator)).isInstanceOf(IllegalStateException.class);
    }
}
