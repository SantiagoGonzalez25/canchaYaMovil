import { render, screen, userEvent } from '@testing-library/react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';

describe('componentes base', () => {
  it('muestra la etiqueta de un badge', async () => {
    await render(<Badge label="Publicado" tone="success" />);
    expect(screen.getByText('Publicado')).toBeOnTheScreen();
  });

  it('ejecuta la acción de un botón al presionarlo', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button title="Guardar cambios" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('expone el estado deshabilitado', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button title="Guardar" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
