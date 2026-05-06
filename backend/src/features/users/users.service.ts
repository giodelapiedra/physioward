import {
  userRepository, UserRow, UserPublicDTO, toPublicDTO,
  CreateUserInput, UpdateUserInput, ListUsersFilters,
} from '../../repositories/user.repository';
import { authService } from '../../services/auth.service';
import { refreshTokenRepository } from '../../repositories/refresh-token.repository';
import { Errors } from '../../shared/errors';
import { Role } from '../../shared/roles';

export const usersService = {
  async list(filters: ListUsersFilters): Promise<UserPublicDTO[]> {
    const rows = await userRepository.list(filters);
    return rows.map(toPublicDTO);
  },

  async get(id: string): Promise<UserPublicDTO> {
    const row = await userRepository.findById(id);
    if (!row) throw Errors.notFound(`User ${id} not found`);
    return toPublicDTO(row);
  },

  async create(input: {
    email:     string;
    password:  string;
    role:      Role;
    full_name: string;
    clinic_id: string | null;
  }): Promise<UserPublicDTO> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw Errors.conflict(`Email ${input.email} is already in use`);

    const passwordHash = await authService.hashPassword(input.password);
    const created = await userRepository.create({
      email:        input.email,
      passwordHash,
      role:         input.role,
      full_name:    input.full_name,
      clinic_id:    input.clinic_id,
    });
    return toPublicDTO(created);
  },

  async update(id: string, patch: UpdateUserInput): Promise<UserPublicDTO> {
    // Block updates to non-existent users explicitly so the route returns 404.
    const existing = await userRepository.findById(id);
    if (!existing) throw Errors.notFound(`User ${id} not found`);

    const updated = await userRepository.update(id, patch);
    if (!updated) throw Errors.notFound(`User ${id} not found`);

    // If the role/clinic changed in a way that broadens or narrows access,
    // existing access tokens still carry the OLD claims for up to 15 minutes
    // (JWT TTL). Revoking refresh tokens forces the user back through login,
    // which is the safe choice for any role/clinic/is_active mutation.
    const sensitive =
      patch.role     !== undefined ||
      patch.clinic_id !== undefined ||
      patch.is_active !== undefined;
    if (sensitive) {
      await refreshTokenRepository.revokeAllForUser(id);
    }

    return toPublicDTO(updated);
  },

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const existing = await userRepository.findById(id);
    if (!existing) throw Errors.notFound(`User ${id} not found`);

    const hash = await authService.hashPassword(newPassword);
    await userRepository.updatePassword(id, hash);
    // Force re-login on all devices.
    await refreshTokenRepository.revokeAllForUser(id);
  },

  async deactivate(id: string): Promise<UserPublicDTO> {
    return this.update(id, { is_active: false });
  },

  async reactivate(id: string): Promise<UserPublicDTO> {
    return this.update(id, { is_active: true });
  },

  /** Used by the dropout entry form's "clinician" dropdown. */
  async listActiveByClinic(clinicId: string, role: Role): Promise<UserPublicDTO[]> {
    const rows = await userRepository.list({
      clinic_id: clinicId,
      role,
      active:    true,
    });
    return rows.map(toPublicDTO);
  },
};
