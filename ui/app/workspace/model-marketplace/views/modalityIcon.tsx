import { FileText, Image as ImageIcon, Music, Shapes, Type, Video } from "lucide-react";

/** Icon for a catalog modality value ("text", "image", …); unknown values get a generic glyph. */
export function ModalityIcon({ modality, className }: { modality: string; className?: string }) {
	const props = { className };
	switch (modality) {
		case "text":
			return <Type {...props} />;
		case "image":
			return <ImageIcon {...props} />;
		case "audio":
			return <Music {...props} />;
		case "video":
			return <Video {...props} />;
		case "file":
			return <FileText {...props} />;
		default:
			return <Shapes {...props} />;
	}
}