package br.com.nexusit.cartridge;

import java.util.List;

public record CartridgeDetailResponse(CartridgeResponse cartridge, List<CartridgeEventResponse> events) {}
