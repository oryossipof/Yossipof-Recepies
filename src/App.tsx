import { ChefHat } from "lucide-react";

import { IconGradients } from "@/components/GradientIcon";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { CategoriesProvider } from "@/hooks/use-categories";
import { ProfileProvider } from "@/hooks/use-profile";
import { RecipesProvider } from "@/hooks/use-recipes";
import { useRoute } from "@/lib/router";
import { AuthScreen } from "@/screens/AuthScreen";
import { CategoriesScreen } from "@/screens/CategoriesScreen";
import { CategoryRecipesScreen } from "@/screens/CategoryRecipesScreen";
import { CookingScreen } from "@/screens/CookingScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { RecipeEditScreen } from "@/screens/RecipeEditScreen";
import { RecipeViewScreen } from "@/screens/RecipeViewScreen";
import { RecoveryScreen } from "@/screens/RecoveryScreen";

export default function App() {
  return (
    <AuthProvider>
      {/*
        The gradients every drawn icon fills itself with. They are defined once
        here rather than inside each icon: an SVG gradient is referenced by id
        from anywhere in the document, and without this element in the tree
        every coloured icon in the app renders black.
      */}
      <IconGradients />
      <Shell />
    </AuthProvider>
  );
}

/** Decides between the splash, the auth screens and the app proper. */
function Shell() {
  const { loading, session, recovering } = useAuth();

  if (loading) return <Splash />;
  // A recovery session is only good for choosing a new password, so it takes
  // priority over everything else.
  if (recovering) return <RecoveryScreen />;
  if (!session) return <AuthScreen />;

  return (
    <ProfileProvider>
      <CategoriesProvider>
        <RecipesProvider>
          <Screens />
        </RecipesProvider>
      </CategoriesProvider>
    </ProfileProvider>
  );
}

function Screens() {
  const route = useRoute();

  switch (route.name) {
    case "recipe":
      return <RecipeViewScreen id={route.id} />;
    case "cook":
      return <CookingScreen id={route.id} />;
    case "new":
      return <RecipeEditScreen />;
    case "edit":
      return <RecipeEditScreen id={route.id} />;
    case "category":
      return <CategoryRecipesScreen id={route.id} />;
    case "categories":
      return <CategoriesScreen />;
    case "profile":
      return <ProfileScreen />;
    default:
      return <HomeScreen />;
  }
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <span className="inline-flex size-14 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <ChefHat className="size-7" />
      </span>
      <p className="text-sm text-muted-foreground">טוען…</p>
    </div>
  );
}
