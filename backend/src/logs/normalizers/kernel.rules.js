const KERNEL_RULES = [
  {
    id: 'kernel_rtw88_firmware_lps_exit_failed',
    pattern: /^(?<driver>rtw88_[a-zA-Z0-9_]+)\s+(?<pci_address>[0-9a-fA-F:.]+):\s+firmware failed to leave lps state$/i,
    event_type: 'wifi_driver_firmware_lps_exit_failed',
    category: 'hardware_driver',
    severity: 'medium',
    icon: 'wifi',
    title: 'Firmware Wi-Fi bloqué en économie d’énergie',
    interpretation_confidence: 0.94,
    buildDescription: ({ driver, pci_address }) => (
      `Le pilote Wi-Fi ${driver} sur le périphérique PCI ${pci_address} signale que le firmware n’a pas réussi à quitter l’état LPS d’économie d’énergie.`
    ),
    buildFields: ({ driver, pci_address }) => ({
      driver,
      pci_address,
      subsystem: 'wifi',
      firmware_state: 'lps',
      failure: 'failed_to_leave_lps_state',
      possible_impact: 'instabilité Wi-Fi ou micro-coupures réseau',
    }),
  },
];

module.exports = {
  KERNEL_RULES,
};
