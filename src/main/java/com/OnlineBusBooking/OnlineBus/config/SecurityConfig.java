package com.OnlineBusBooking.OnlineBus.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import com.OnlineBusBooking.OnlineBus.model.User;
import com.OnlineBusBooking.OnlineBus.repository.UserRepository;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final UserRepository userRepository;

    public SecurityConfig(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            User user = userRepository.findByEmail(username)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found"));

            String normalizedRole = user.getRole() == null ? "USER" : user.getRole().trim().toUpperCase();
            return new org.springframework.security.core.userdetails.User(
                    user.getEmail(),
                    user.getPassword(),
                    List.of(new SimpleGrantedAuthority("ROLE_" + normalizedRole))
            );
        };
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            String username = authentication.getName();
            userRepository.findByEmail(username).ifPresent(u -> {
                request.getSession().setAttribute("email", u.getEmail());
                request.getSession().setAttribute("name", u.getName());
            });

            for (GrantedAuthority authority : authentication.getAuthorities()) {
                String role = authority.getAuthority();
                if (role.equals("ROLE_ADMIN")) {
                    response.sendRedirect("/admin-dashboard");
                    return;
                } else if (role.equals("ROLE_AGENT")) {
                    response.sendRedirect("/agent-dashboard");
                    return;
                } else if (role.equals("ROLE_USER")) {
                    response.sendRedirect("/user/dashboard");
                    return;
                }
            }
            response.sendRedirect("/");
        };
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints and static assets (includes landing page "/")
                        .requestMatchers(
                                "/",                       // landing page
                                "/login", "/register",
                                "/forgot-password", "/reset-password",
                                "/api/auth/**",
                                "/api/search-buses", "/api/buses/**", "/api/routes/**",
                                "/api/seats/**", "/api/schedule/**", "/api/payments/**",
                                "/css/**", "/js/**", "/images/**", "/fonts/**", "/svg/**"
                        ).permitAll()

                        // Role-based protections
                        .requestMatchers("/admin-dashboard", "/admin/**").hasRole("ADMIN")
                        .requestMatchers("/agent/api/agents/**").hasRole("ADMIN")   // add/list agents
                        .requestMatchers("/agent-dashboard", "/agent/**").hasRole("AGENT")
                        .requestMatchers("/user/**", "/user/passenger-details.html").hasRole("USER")

                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .loginProcessingUrl("/process-login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        .successHandler(successHandler())
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutSuccessUrl("/login?logout")
                        .permitAll()
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation().migrateSession()
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}