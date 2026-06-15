import NovaChatLogo from "@/assets/nova-ai-logo.png";

interface Props {
  onClick: () => void;
  isSelected: boolean;
}

const AiAssistantItem = ({ onClick, isSelected }: Props) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer rounded-lg transition-all
        ${
          isSelected
            ? "bg-primary/15 border-l-2 border-primary"
            : "hover:bg-muted/60"
        }`}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
          <img
            src={NovaChatLogo}
            alt="NovaChat AI"
            className="w-full h-full object-cover"
          />
        </div>
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-sm">NovaChat AI</span>
          <span className="text-xs text-muted-foreground">Always on</span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          Ask me anything ✨
        </p>
      </div>
    </div>
  );
};

export default AiAssistantItem;
