import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, QrCode as QrCodeIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface DepositAddress {
  network: string;
  address: string;
}

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  addresses: DepositAddress[];
}

export default function DepositModal({ open, onClose, addresses }: DepositModalProps) {
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<string>("TRC20");
  const [showQR, setShowQR] = useState(false);

  const selectedAddress = addresses.find((a) => a.network === selectedNetwork);

  const handleCopy = () => {
    if (selectedAddress) {
      navigator.clipboard.writeText(selectedAddress.address);
      toast({
        title: "Copied!",
        description: "Deposit address copied to clipboard",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
        {/* Fixed Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle>Deposit USDT</DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="px-6 py-4 overflow-y-auto flex-grow">
          <div className="space-y-6">
            {/* Network Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Network</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedNetwork("TRC20")}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedNetwork === "TRC20"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">TRC20</div>
                  <div className="text-xs text-muted-foreground">TRON Network</div>
                </button>
                <button
                  onClick={() => setSelectedNetwork("BEP20")}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedNetwork === "BEP20"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">BEP20</div>
                  <div className="text-xs text-muted-foreground">BSC Network</div>
                </button>
              </div>
            </div>

            {/* Deposit Address */}
            {selectedAddress ? (
              <div>
                <label className="block text-sm font-medium mb-2">Deposit Address</label>
                <div className="bg-secondary rounded-lg p-4 break-all">
                  <p className="text-sm font-mono">{selectedAddress.address}</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Copy size={18} />
                    Copy Address
                  </button>
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/90 transition-colors"
                  >
                    <QrCodeIcon size={18} />
                    {showQR ? "Hide QR" : "Show QR"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-secondary rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Generating deposit address...</p>
              </div>
            )}

            {/* QR Code */}
            {showQR && selectedAddress && (
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <QRCodeSVG value={selectedAddress.address} size={200} />
              </div>
            )}

            {/* Important Information */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">⚠️ Important</h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Minimum deposit: <strong>10 USDT</strong></li>
                <li>• This is your permanent deposit address - save it for future deposits</li>
                <li>• Only send <strong>USDT</strong> on the selected network</li>
                <li>• Deposits are credited after network confirmations (5-30 min)</li>
                <li>• Sending other tokens may result in permanent loss</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
