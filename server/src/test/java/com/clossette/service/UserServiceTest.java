package com.clossette.service;

import com.clossette.entity.User;
import com.clossette.repository.UserRepository;
import com.clossette.testsupport.TestUsers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    UserRepository userRepository;

    @InjectMocks
    UserService userService;

    @Test
    void findByEmail_existing_returnsUser() {
        var buyer = TestUsers.aBuyer();
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));

        User result = userService.findByEmail(buyer.getEmail());

        assertThat(result.getId()).isEqualTo(buyer.getId());
    }

    @Test
    void findByEmail_notFound_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findByEmail("ghost@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void findById_existing_returnsUser() {
        var buyer = TestUsers.aBuyer();
        when(userRepository.findById(buyer.getId())).thenReturn(Optional.of(buyer));

        User result = userService.findById(buyer.getId());

        assertThat(result.getEmail()).isEqualTo(buyer.getEmail());
    }

    @Test
    void getCurrentUser_authenticated_returnsUser() {
        var buyer = TestUsers.aBuyer();
        Authentication auth = mock(Authentication.class);
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getName()).thenReturn(buyer.getEmail());
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));

        User result = userService.getCurrentUser(auth);

        assertThat(result.getId()).isEqualTo(buyer.getId());
    }

    @Test
    void getCurrentUser_nullAuthentication_throwsIllegalStateException() {
        assertThatThrownBy(() -> userService.getCurrentUser(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No authenticated user");
    }
}
