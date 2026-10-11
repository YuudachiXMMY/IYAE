package com.iyae.config;

import com.iyae.ai.AIProviderException;
import com.iyae.dto.ErrorResponse;
import com.iyae.exception.EmailNotVerifiedException;
import com.iyae.exception.PaymentsDisabledException;
import com.iyae.service.AuthMailService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(message, HttpStatus.BAD_REQUEST.value(), Instant.now()));
    }

    @ExceptionHandler(AIProviderException.class)
    public ResponseEntity<ErrorResponse> handleAIProviderException(AIProviderException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ErrorResponse("AI service unavailable: " + ex.getMessage(), HttpStatus.SERVICE_UNAVAILABLE.value(), Instant.now()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Access denied", HttpStatus.FORBIDDEN.value(), Instant.now()));
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ErrorResponse> handleEmailNotVerified(EmailNotVerifiedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse(ex.getMessage(), HttpStatus.FORBIDDEN.value(), Instant.now()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("Invalid request data", HttpStatus.BAD_REQUEST.value(), Instant.now()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), Instant.now()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause().getMessage();
        if (msg != null && msg.toLowerCase().contains("username")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("Username already taken", HttpStatus.CONFLICT.value(), Instant.now()));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("Data conflict: please retry", HttpStatus.CONFLICT.value(), Instant.now()));
    }

    @ExceptionHandler(AuthMailService.EmailDeliveryException.class)
    public ResponseEntity<ErrorResponse> handleEmailDelivery(AuthMailService.EmailDeliveryException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ErrorResponse("Email service unavailable: " + ex.getMessage(), HttpStatus.SERVICE_UNAVAILABLE.value(), Instant.now()));
    }

    @ExceptionHandler(PaymentsDisabledException.class)
    public ResponseEntity<ErrorResponse> handlePaymentsDisabled(PaymentsDisabledException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ErrorResponse(ex.getMessage(), HttpStatus.SERVICE_UNAVAILABLE.value(), Instant.now()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(new ErrorResponse("Uploaded file is too large (max 10 MB)", HttpStatus.PAYLOAD_TOO_LARGE.value(), Instant.now()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex, HttpServletRequest request) {
        // This used to return the 500 and log nothing at all, so every unexpected exception —
        // the ones you most need to see — vanished with no server-side trace. The correlation id
        // goes to the client too, so a user's screenshot can be tied to a specific stack trace
        // without the response ever carrying the exception's own text.
        String errorId = UUID.randomUUID().toString().substring(0, 8);
        log.error("Unhandled exception [{}] on {} {}", errorId, request.getMethod(),
            request.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("Internal server error (ref " + errorId + ")",
                HttpStatus.INTERNAL_SERVER_ERROR.value(), Instant.now()));
    }
}
