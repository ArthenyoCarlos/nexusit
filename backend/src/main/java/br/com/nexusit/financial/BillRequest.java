package br.com.nexusit.financial;

import java.math.BigDecimal;
import java.time.LocalDate;

public record BillRequest(String title, String vendor, String category, BigDecimal amount, LocalDate dueDate, String notes) {}
