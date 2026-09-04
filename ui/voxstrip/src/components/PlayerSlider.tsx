import { useState } from 'react';
import { Slider } from '@skeletonlabs/skeleton-react';

interface PlayerSliderProps {
  value: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  // Continuous sliders (volume, blend) apply while dragging; committed
  // sliders (seek) hold a local value during the drag and apply on release,
  // so the thumb doesn't fight incoming playback-position updates.
  continuous?: boolean;
  ariaLabel: string;
  className?: string;
}

export default function PlayerSlider({
  value,
  max,
  step = 1,
  onChange,
  continuous = false,
  ariaLabel,
  className,
}: PlayerSliderProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);

  return (
    <Slider
      value={[dragValue ?? value]}
      max={max || 1}
      step={step}
      onValueChange={(details) => {
        if (continuous) {
          onChange(details.value[0]);
        } else {
          setDragValue(details.value[0]);
        }
      }}
      onValueChangeEnd={(details) => {
        if (!continuous) {
          onChange(details.value[0]);
          setDragValue(null);
        }
      }}
      className={className}
      aria-label={[ariaLabel]}
    >
      <Slider.Control>
        <Slider.Track>
          <Slider.Range />
        </Slider.Track>
        <Slider.Thumb index={0}>
          <Slider.HiddenInput />
        </Slider.Thumb>
      </Slider.Control>
    </Slider>
  );
}
