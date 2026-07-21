package br.com.nexusit.cartridge;

/** Setor é opcional — só ajuda a saber de onde o cartucho veio, quando quem escaneia sabe. */
public record MaintenanceStartRequest(String sector) {}
