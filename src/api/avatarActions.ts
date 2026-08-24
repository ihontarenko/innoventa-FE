import { http } from "./http"
import type { AvatarView } from "./avatars"

/**
 * Choosing your own face — the three verbs behind `/api/me/avatar`.
 *
 * ⚠️ **A preset is a DESCRIPTOR, not a saved picture.** Innoventa used to weave a face on the server and
 * store the result as a file (`AvatarStudioModal`); under the shared model the column holds the string a
 * face is drawn from, and the drawing happens in the browser every time. Nothing is uploaded, nothing is
 * stored, and the same descriptor always draws the same face.
 */
export const avatarActions = {
  /**
   * Wear a generated face, drawn from this descriptor.
   *
   * ⚠️ A DESCRIPTOR, not a bare seed: `avatar.1.<strategy>.<seed>.<base64 parameters>`, carrying the
   * strategy that draws the face and whatever its controls were set to. A bare seed stays valid
   * forever and reads as the classic generator, which is why no stored value had to move.
   *
   * ⚠️ It goes as a query parameter and carries base64, so plus, slash and equals are in it. Axios
   * percent-encodes them and Spring decodes them back — the hazard to remember is a caller that builds
   * this URL by hand, where a raw plus arrives as a space.
   */
  choosePreset: (descriptor: string) =>
    http.put<AvatarView>("/me/avatar", null, { params: { descriptor } }).then((response) => response.data),

  /** Wear an uploaded picture — already cropped square by the interface. */
  uploadPicture: (picture: Blob) => {
    const body = new FormData()

    body.append("file", picture, "avatar.png")

    return http.post<AvatarView>("/me/avatar", body).then((response) => response.data)
  },

  /** Drop back to drawn initials. */
  clear: () => http.delete<AvatarView>("/me/avatar").then((response) => response.data),
}
