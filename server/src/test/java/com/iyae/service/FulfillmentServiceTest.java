package com.iyae.service;

import com.iyae.dto.CheckoutRequest;
import com.iyae.dto.ShippingOptionResponse;
import com.iyae.entity.PickupLocation;
import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.ShippingCarrier;
import com.iyae.repository.PickupLocationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FulfillmentServiceTest {

    @Mock PickupLocationRepository pickupLocationRepository;
    @InjectMocks FulfillmentService service;

    private PickupLocation activeLocation() {
        return PickupLocation.builder().id(1L).name("IYAE Studio").addressLine("401 Queen St W")
                .city("Toronto").instructions("Ring the buzzer").active(true).build();
    }

    @Test
    void resolve_shipWithCarrier_setsFeeAndNullPickup() {
        var res = service.resolve(new CheckoutRequest(FulfillmentMethod.SHIP, null, ShippingCarrier.UPS));
        assertThat(res.method()).isEqualTo(FulfillmentMethod.SHIP);
        assertThat(res.carrier()).isEqualTo(ShippingCarrier.UPS);
        assertThat(res.pickupLocationId()).isNull();
        assertThat(res.fee()).isEqualByComparingTo(new BigDecimal("12.99"));
    }

    @Test
    void resolve_pickupWithValidLocation_feeZeroAndNullCarrier() {
        when(pickupLocationRepository.findById(1L)).thenReturn(Optional.of(activeLocation()));
        var res = service.resolve(new CheckoutRequest(FulfillmentMethod.PICKUP, 1L, null));
        assertThat(res.method()).isEqualTo(FulfillmentMethod.PICKUP);
        assertThat(res.pickupLocationId()).isEqualTo(1L);
        assertThat(res.carrier()).isNull();
        assertThat(res.fee()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void resolve_shipWithoutCarrier_throws() {
        assertThatThrownBy(() -> service.resolve(new CheckoutRequest(FulfillmentMethod.SHIP, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resolve_pickupWithoutLocation_throws() {
        assertThatThrownBy(() -> service.resolve(new CheckoutRequest(FulfillmentMethod.PICKUP, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resolve_pickupWithUnknownOrInactiveLocation_throws() {
        when(pickupLocationRepository.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resolve(new CheckoutRequest(FulfillmentMethod.PICKUP, 999L, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resolve_mutuallyExclusive_shipWithPickupLocation_throws() {
        assertThatThrownBy(() -> service.resolve(
                new CheckoutRequest(FulfillmentMethod.SHIP, 1L, ShippingCarrier.UPS)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resolve_nullRequest_defaultsToShipWithNonZeroFee() {
        var res = service.resolve(null);
        assertThat(res.method()).isEqualTo(FulfillmentMethod.SHIP);
        assertThat(res.carrier()).isNotNull();
        assertThat(res.carrier()).isNotEqualTo(ShippingCarrier.CANADA_POST);
        assertThat(res.fee()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void listShippingOptions_neverCanadaPostOnly_guardrail() {
        List<ShippingOptionResponse> options = service.listShippingOptions();
        assertThat(options.size()).isGreaterThanOrEqualTo(2);
        assertThat(options).anyMatch(o -> !"CANADA_POST".equals(o.carrier()));
    }
}
