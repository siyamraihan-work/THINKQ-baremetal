package com.helpdesk.data.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Configuration
public class SecurityConfig {

    @Bean
    public FilterRegistrationBean<InternalApiKeyFilter> internalApiKeyFilterRegistration(InternalApiKeyFilter filter) {
        FilterRegistrationBean<InternalApiKeyFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(filter);
        registration.addUrlPatterns("/internal/*");
        return registration;
    }

    @Component
    public static class InternalApiKeyFilter extends OncePerRequestFilter {
        @Value("${security.internal-api-key}")
        private String expectedApiKey;

        @Value("${security.allow-empty-internal-api-key:false}")
        private boolean allowEmptyInternalApiKey;

        @PostConstruct
        public void validateConfiguration() {
            if (!allowEmptyInternalApiKey && (expectedApiKey == null || expectedApiKey.isBlank())) {
                throw new IllegalStateException("INTERNAL_API_KEY is required for data-service internal routes");
            }
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                throws ServletException, IOException {
            String header = request.getHeader("x-internal-api-key");
            if (header == null || !MessageDigest.isEqual(
                    header.getBytes(StandardCharsets.UTF_8),
                    expectedApiKey.getBytes(StandardCharsets.UTF_8)
            )) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("Missing or invalid internal API key");
                return;
            }
            filterChain.doFilter(request, response);
        }
    }
}
