package com.OnlineBusBooking.OnlineBus.controller;

import com.OnlineBusBooking.OnlineBus.model.User;
import com.OnlineBusBooking.OnlineBus.repository.UserRepository;
import com.OnlineBusBooking.OnlineBus.service.AuthService;
import com.OnlineBusBooking.OnlineBus.service.EmailService;
import com.OnlineBusBooking.OnlineBus.service.OtpService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.security.Principal;

@Controller
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private OtpService otpService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    // ✅ Login Page
    @GetMapping("/login")
    public String showLoginPage() {
        return "login";
    }

    // ✅ Register Page
    @GetMapping("/register")
    public String showRegisterPage() {
        return "register";
    }

    // ✅ Register User
    @PostMapping("/api/auth/register")
    @ResponseBody
    public ResponseEntity<String> registerUser(@RequestBody User user) {
        if (authService.emailExists(user.getEmail())) {
            return ResponseEntity.badRequest().body("❌ Email already registered.");
        }
        if (authService.phoneExists(user.getPhone())) {
            return ResponseEntity.badRequest().body("❌ Phone number already registered.");
        }
        authService.registerUser(user);
        return ResponseEntity.ok("✅ User registered successfully.");
    }

    // Spring Security now handles POST /process-login via SecurityConfig

    // ✅ User Dashboard
    @GetMapping("/dashboard")
    public String showUserDashboard(Model model) {
        model.addAttribute("welcomeMessage", "Welcome to your user dashboard!");
        return "userDashboard";
    }

    @GetMapping("/admin-dashboard")
    public String showAdminDashboard() {
        return "adminDashboard";
    }

    @GetMapping("/agent-dashboard")
    public String showAgentDashboard(HttpServletRequest request, Principal principal, Model model) {
        // Ensure session has email/name for agent.js data attributes
        if (principal != null) {
            String email = principal.getName();
            request.getSession().setAttribute("email", email);
            userRepository.findByEmail(email).ifPresent(u -> request.getSession().setAttribute("name", u.getName()));
        }
        return "agentDashboard";
    }

    // ✅ Send OTP
    @PostMapping("/api/auth/send-otp")
    @ResponseBody
    public ResponseEntity<String> sendOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (otpService.generateAndSendOtp(email)) {
            return ResponseEntity.ok("✅ OTP sent successfully to " + email);
        } else {
            return ResponseEntity.status(500).body("❌ Failed to send OTP. Please try again.");
        }
    }

    // ✅ Verify OTP
    @PostMapping("/api/auth/verify-otp")
    @ResponseBody
    public ResponseEntity<String> verifyOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otp = request.get("otp");

        if (otpService.validateOtp(email, otp)) {
            otpService.clearOtp(email);
            return ResponseEntity.ok("✅ OTP verified successfully.");
        } else {
            return ResponseEntity.status(400).body("❌ Invalid OTP. Please try again.");
        }
    }

    // ✅ Forgot Password - Form
    @GetMapping("/forgot-password")
    public String showForgotPasswordForm() {
        return "forgot-password"; // Thymeleaf template
    }
    @Value("${app.base-url}")
    private String baseUrl;
    @PostMapping("/forgot-password")
    public String processForgotPassword(@RequestParam("email") String email, Model model, HttpServletRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            userRepository.save(user);

            // ✅ Dynamically generate base URL from request
            String baseUrl = request.getScheme() + "://" + request.getServerName()
                    + (request.getServerPort() != 80 && request.getServerPort() != 443 ? ":" + request.getServerPort() : "");

            String resetLink = baseUrl + "/reset-password?token=" + token;

            String body = "Hi " + user.getName() + ",\n\n"
                    + "Click the link below to reset your password:\n"
                    + resetLink + "\n\n"
                    + "If you didn’t request this, ignore this email.\n\n"
                    + "— Online Bus Booking Team";

            emailService.sendEmail(user.getEmail(), "🔐 Password Reset Request", body);
            model.addAttribute("message", "A reset link has been sent to your email.");
        } else {
            model.addAttribute("error", "Email not registered.");
        }
        return "forgot-password";
    }


    // ✅ Reset Password - Form
    @GetMapping("/reset-password")
    public String showResetPasswordForm(@RequestParam("token") String token, Model model) {
        model.addAttribute("token", token);
        return "reset-password";
    }

    // ✅ Reset Password - Update Password
    @PostMapping("/reset-password")
    public String resetPassword(@RequestParam("token") String token,
                                @RequestParam("password") String password,
                                Model model) {
        Optional<User> userOpt = userRepository.findByResetToken(token);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setPassword(new BCryptPasswordEncoder().encode(password));
            user.setResetToken(null);
            userRepository.save(user);
            model.addAttribute("message", "✅ Password updated. You can now login.");
            return "login";
        } else {
            model.addAttribute("error", "Invalid or expired token.");
            return "reset-password";
        }
    }
}
